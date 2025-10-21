/**
 * Payment HTTP route handlers for merchant charges and peer transfers.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../models/base';
import { AuthService } from '../services/AuthService';
import { PaymentService } from '../services/PaymentService';
import { WalletService } from '../services/WalletService';
import {
  Clock,
  Logger,
  NullLogger,
  SystemClock,
  TransactionRepository,
  UserRepository,
} from '../services/types';
import { HttpError, badRequest, fromValidationError } from './errors';
import { ensureAuthenticated } from './handler';
import { ok } from './responses';
import { HttpRequest } from './types';
import { normalizeEmail, normalizeKenyanPhone, requireNumber, requireString } from './validation';

interface MerchantInfoPayload {
  name?: string;
  till_number?: string;
  paybill_number?: string;
  account_number?: string;
}

interface MerchantPaymentBody {
  amount?: number;
  pin_token?: string;
  merchant_info?: MerchantInfoPayload;
  description?: string;
}

interface TransferRecipientPayload {
  phone?: string;
  email?: string;
  name?: string;
}

interface TransferPaymentBody {
  amount?: number;
  pin_token?: string;
  recipient?: TransferRecipientPayload;
  description?: string;
}

interface TopUpBody {
  amount?: number;
  payment_method?: string;
  description?: string;
}

export interface PaymentRouteDependencies {
  paymentService: PaymentService;
  authService: AuthService;
  walletService: WalletService;
  userRepository: UserRepository;
  transactionRepository: TransactionRepository;
  clock?: Clock;
  logger?: Logger;
}

const MIN_TRANSACTION_AMOUNT = 100; // cents → KES 1.00
const MAX_TRANSACTION_AMOUNT = 500_000; // cents → KES 5,000.00
const MAX_TOPUP_AMOUNT = 100_000_000; // cents → KES 1,000,000.00
const DAILY_TRANSACTION_LIMIT = 2_000_000; // cents → KES 20,000.00

export function createPaymentRoutes({
  paymentService,
  authService,
  walletService,
  userRepository,
  transactionRepository,
  clock = new SystemClock(),
  logger = NullLogger,
}: PaymentRouteDependencies) {
  return {
    verifyPayment: async (request: HttpRequest<{ reference?: string }>) => {
      ensureAuthenticated(request);

      const reference = requireString(
        request.body?.reference,
        'Payment reference is required',
        'MISSING_REFERENCE'
      );

      const transaction = await transactionRepository.findByExternalReference(reference);
      if (!transaction) {
        throw new HttpError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
      }

      if (transaction.userId !== request.userId) {
        throw new HttpError(403, 'Access denied', 'ACCESS_DENIED');
      }

      if (transaction.status === 'completed') {
        logger.info('Payment already verified', {
          userId: request.userId,
          reference,
        });
        return ok({
          transaction_id: transaction.id,
          status: 'completed',
          amount: transaction.amount,
          verified_at: transaction.updatedAt?.toISOString(),
        });
      }

      try {
        // Update transaction status to completed
        const updatedTransaction = await transactionRepository.update({
          ...transaction,
          status: 'completed',
          updatedAt: clock.now(),
        });

        // If this is a deposit, credit the user's main wallet
        if (updatedTransaction.type === 'deposit') {
          await walletService.credit({ userId: request.userId, walletType: 'main', amount: updatedTransaction.amount });
        }

        logger.info('Payment verified successfully', {
          userId: request.userId,
          reference,
          transactionId: transaction.id,
        });

        return ok({
          transaction_id: updatedTransaction.id,
          status: 'completed',
          amount: updatedTransaction.amount,
          verified_at: updatedTransaction.updatedAt?.toISOString(),
        });
      } catch (error) {
        logger.error('Payment verification failed', {
          userId: request.userId,
          reference,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new HttpError(503, 'Payment verification failed', 'VERIFICATION_FAILED');
      }
    },

    payMerchant: async (request: HttpRequest<MerchantPaymentBody>) => {
      ensureAuthenticated(request);

      const amount = parseAmount(request.body?.amount, 'Minimum payment amount is KES 1.00');
      const pinToken = parsePinToken(request.body?.pin_token, 'PIN token is required for payment authorization');
      const merchant = parseMerchantInfo(request.body?.merchant_info);
      const description = request.body?.description?.trim() ?? null;

      const user = await userRepository.findById(request.userId);
      if (!user) {
        throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
      }

      const customerEmail = user.email ?? `${request.userId}@zanari.app`;
      let customerPhone: string | null = null;
      if (user.phone) {
        try {
          customerPhone = normalizeKenyanPhone(user.phone);
        } catch {
          customerPhone = null;
        }
      }

      await enforceDailyLimit(transactionRepository, request.userId, amount, clock);

      const mainWallet = await requireMainWallet(walletService, request.userId);
      const availableBefore = mainWallet.availableBalance;
      if (availableBefore < amount) {
        throw new HttpError(402, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
          available_balance: availableBefore,
          round_up_skipped: false,
        });
      }

      const pinValid = await authService.validatePinToken(request.userId, pinToken);
      if (!pinValid) {
        throw new HttpError(401, 'PIN token expired', 'PIN_TOKEN_EXPIRED');
      }

      try {
        const result = await paymentService.payMerchant({
          paymentId: randomUUID(),
          userId: request.userId,
          amount,
          pinToken,
          merchantInfo: merchant.merchantInfo,
          description,
          customerEmail,
          customerPhone,
          channels: ['mobile_money', 'card'],
          currency: 'KES',
          callbackUrl: process.env.PAYSTACK_CALLBACK_URL ?? undefined,
        });

        await authService.invalidatePinToken(pinToken);

        if (result.status === 'failed') {
          const retryAfter = computeRetryAfterSeconds(result.scheduledRetry?.runAt, clock.now());
          throw new HttpError(503, 'Payment service temporarily unavailable', 'PAYSTACK_UNAVAILABLE', {
            retry_after: retryAfter,
          });
        }

        const roundUpSkipped = determineRoundUpSkipped({
          roundUpAmount: result.roundUpAmount,
          roundUpTransactionId: result.roundUpTransaction?.id ?? null,
          originalAmount: amount,
          initialAvailable: availableBefore,
        });

        const checkout = result.checkoutSession ?? null;
        const responseBody = {
          payment_transaction_id: result.paymentTransaction.id,
          round_up_transaction_id: result.roundUpTransaction?.id ?? null,
          total_charged: result.totalCharged,
          round_up_amount: result.roundUpAmount,
          paystack_reference: checkout?.reference ?? null,
          paystack_access_code: checkout?.accessCode ?? null,
          paystack_authorization_url: checkout?.authorizationUrl ?? null,
          paystack_status: checkout?.status ?? result.status,
          round_up_skipped: roundUpSkipped.skipped,
          round_up_skip_reason: roundUpSkipped.reason,
        } as Record<string, unknown>;

        if (checkout?.expiresAt) {
          responseBody.paystack_checkout_expires_at = checkout.expiresAt.toISOString();
        }

        if (result.status === 'pending' && result.scheduledRetry) {
          responseBody.status = 'pending';
          responseBody.retry_after = computeRetryAfterSeconds(result.scheduledRetry.runAt, clock.now());
        }

        logger.info('Merchant payment initiated', {
          userId: request.userId,
          amount,
          roundUpAmount: result.roundUpAmount,
          status: result.status,
        });

        return ok(responseBody);
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        if (error instanceof Error && error.message === 'Insufficient funds') {
          throw new HttpError(402, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
            available_balance: availableBefore,
            round_up_skipped: false,
          });
        }
        if (error instanceof Error) {
          logger.error('Paystack merchant payment failed', {
            userId: request.userId,
            error: error.message,
          });
          throw new HttpError(503, 'Payment service temporarily unavailable', 'PAYSTACK_UNAVAILABLE');
        }
        throw error;
      }
    },

    transferPeer: async (request: HttpRequest<TransferPaymentBody>) => {
      ensureAuthenticated(request);

      const amount = parseAmount(request.body?.amount, 'Minimum transfer amount is KES 1.00');
      const pinToken = parsePinToken(request.body?.pin_token, 'PIN token is required for transfer authorization');
      const recipient = await parseRecipient(request.userId, request.body?.recipient, userRepository);
      const description = request.body?.description?.trim() ?? null;

      await enforceDailyLimit(transactionRepository, request.userId, amount, clock);

      const mainWallet = await requireMainWallet(walletService, request.userId);
      const availableBefore = mainWallet.availableBalance;
      if (availableBefore < amount) {
        throw new HttpError(402, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
          available_balance: availableBefore,
          round_up_skipped: false,
        });
      }

      const pinValid = await authService.validatePinToken(request.userId, pinToken);
      if (!pinValid) {
        throw new HttpError(401, 'PIN token expired', 'PIN_TOKEN_EXPIRED');
      }

      try {
        const result = await paymentService.transferPeer({
          transferId: recipient.generateTransactionId('transfer'),
          userId: request.userId,
          amount,
          pinToken,
          recipient: recipient.recipient,
          description,
        });

        await authService.invalidatePinToken(pinToken);

        if (result.status === 'failed') {
          const retryAfter = computeRetryAfterSeconds(result.scheduledRetry?.runAt, clock.now());
          throw new HttpError(503, 'Transfer service temporarily unavailable', 'PAYSTACK_TRANSFER_UNAVAILABLE', {
            retry_after: retryAfter,
          });
        }

        const roundUpSkipped = determineRoundUpSkipped({
          roundUpAmount: result.roundUpAmount,
          roundUpTransactionId: result.roundUpTransaction?.id ?? null,
          originalAmount: amount,
          initialAvailable: availableBefore,
        });

        const body = {
          transfer_transaction_id: result.transferTransaction.id,
          round_up_transaction_id: result.roundUpTransaction?.id ?? null,
          total_charged: result.totalCharged,
          round_up_amount: result.roundUpAmount,
          paystack_transfer_reference: result.paystackTransferReference ?? `ps_transfer_ref_${result.transferTransaction.id}`,
          paystack_recipient_code: result.paystackRecipientCode ?? `rcp_ps_${randomSuffix(result.transferTransaction.id)}`,
          estimated_completion: result.estimatedCompletion?.toISOString() ?? null,
          round_up_skipped: roundUpSkipped.skipped,
          round_up_skip_reason: roundUpSkipped.reason,
          recipient_created: recipient.isNewRecipient,
        } as Record<string, unknown>;

        if (result.status === 'pending' && result.scheduledRetry) {
          body.status = 'pending';
          body.retry_after = computeRetryAfterSeconds(result.scheduledRetry.runAt, clock.now());
        }

        logger.info('Peer transfer initiated', {
          userId: request.userId,
          amount,
          roundUpAmount: result.roundUpAmount,
          status: result.status,
        });

        return ok(body);
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        if (error instanceof Error) {
          if (error.message === 'Cannot transfer money to yourself') {
            throw badRequest('Cannot transfer money to yourself', 'SELF_TRANSFER_NOT_ALLOWED');
          }
          if (error.message === 'Insufficient funds') {
            throw new HttpError(402, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
              available_balance: availableBefore,
              round_up_skipped: false,
            });
          }
        }
        throw error;
      }
    },

    topUpWallet: async (request: HttpRequest<TopUpBody>) => {
      ensureAuthenticated(request);

      // Validate amount for top-up (allow larger amounts than regular payments)
      const rawAmount = requireNumber(request.body?.amount, 'Amount must be a positive integer in cents', 'INVALID_AMOUNT_FORMAT');
      if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
        throw badRequest('Amount must be a positive integer in cents', 'INVALID_AMOUNT_FORMAT');
      }
      if (rawAmount < MIN_TRANSACTION_AMOUNT) {
        throw badRequest('Minimum top-up amount is KES 1.00', 'AMOUNT_TOO_LOW');
      }
      if (rawAmount > MAX_TOPUP_AMOUNT) {
        throw badRequest('Maximum top-up amount is KES 1,000,000.00', 'AMOUNT_TOO_HIGH');
      }

      const amount = rawAmount;
      const description = request.body?.description?.trim() ?? 'Wallet top-up';

      const user = await userRepository.findById(request.userId);
      if (!user) {
        throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
      }

      const customerEmail = user.email ?? `${request.userId}@zanari.app`;
      let customerPhone: string | null = null;
      if (user.phone) {
        try {
          customerPhone = normalizeKenyanPhone(user.phone);
        } catch {
          customerPhone = null;
        }
      }

      try {
        // Initialize Paystack transaction to RECEIVE money from user
        // This is a DEPOSIT transaction - user pays with external payment (M-Pesa/Card)
        // to add money to their wallet
        const depositId = randomUUID();

        const result = await paymentService.initializeDeposit({
          depositId,
          userId: request.userId,
          amount,
          description,
          customerEmail,
          customerPhone,
          channels: ['mobile_money', 'card'],
          currency: 'KES',
          callbackUrl: process.env.PAYSTACK_CALLBACK_URL ?? undefined,
        });

        const checkout = result.checkoutSession;
        if (!checkout) {
          throw new HttpError(503, 'Payment service temporarily unavailable', 'PAYSTACK_UNAVAILABLE');
        }

        // Return Paystack checkout session for frontend
        // Wallet will be CREDITED (not debited) when payment succeeds via webhook
        const responseBody = {
          deposit_transaction_id: depositId,
          amount: amount,
          paystack_reference: checkout.reference,
          paystack_access_code: checkout.accessCode,
          paystack_authorization_url: checkout.authorizationUrl,
          paystack_status: checkout.status,
          description,
        } as Record<string, unknown>;

        if (checkout.expiresAt) {
          responseBody.paystack_checkout_expires_at = checkout.expiresAt.toISOString();
        }

        logger.info('Wallet top-up initiated', {
          userId: request.userId,
          amount,
          depositId,
          paystackReference: checkout.reference,
        });

        return ok(responseBody);
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        if (error instanceof Error) {
          logger.error('Wallet top-up initialization failed', {
            userId: request.userId,
            amount,
            error: error.message,
          });
          throw new HttpError(503, 'Top-up service temporarily unavailable', 'TOPUP_UNAVAILABLE');
        }
        throw error;
      }
    },
  };
}

function parseAmount(rawAmount: number | undefined, minMessage: string): number {
  const amount = requireNumber(rawAmount, 'Amount must be a positive integer in cents', 'INVALID_AMOUNT_FORMAT');
  if (!Number.isInteger(amount) || amount <= 0) {
    throw badRequest('Amount must be a positive integer in cents', 'INVALID_AMOUNT_FORMAT');
  }
  if (amount < MIN_TRANSACTION_AMOUNT) {
    throw badRequest(minMessage, 'AMOUNT_TOO_LOW');
  }
  if (amount > MAX_TRANSACTION_AMOUNT) {
    throw badRequest('Maximum single payment amount is KES 5,000.00', 'AMOUNT_TOO_HIGH');
  }
  return amount;
}

function parsePinToken(rawToken: string | undefined, message: string): string {
  const token = requireString(rawToken, message, 'MISSING_PIN_TOKEN');
  if (!/^txn_[a-zA-Z0-9]+$/.test(token)) {
    throw badRequest('Invalid PIN token format', 'INVALID_PIN_TOKEN_FORMAT');
  }
  return token;
}

function parseMerchantInfo(raw: MerchantInfoPayload | undefined) {
  if (!raw) {
    throw badRequest('Merchant information is required', 'MISSING_MERCHANT_INFO');
  }

  const name = requireString(raw.name, 'Merchant name is required', 'INVALID_MERCHANT_NAME');
  const tillNumber = raw.till_number?.trim();
  const paybillNumber = raw.paybill_number?.trim();
  const accountNumber = raw.account_number?.trim();

  if (tillNumber && (paybillNumber || accountNumber)) {
    throw badRequest('Provide either till number or paybill details, not both', 'CONFLICTING_MERCHANT_INFO');
  }

  if (!tillNumber && !paybillNumber) {
    throw badRequest('Either till_number or paybill_number must be provided', 'MISSING_MERCHANT_CHANNEL');
  }

  if (tillNumber) {
    if (!/^[0-9]{4,10}$/.test(tillNumber)) {
      throw badRequest('Invalid till number format', 'INVALID_TILL_NUMBER');
    }
    return {
      merchantInfo: {
        name,
        tillNumber,
        paybillNumber: null,
        accountNumber: null,
      },
      generateTransactionId: (prefix: 'payment' | 'transfer') => `${prefix}_${randomSuffix(tillNumber)}`,
      reference: `ps_ref_${randomSuffix(tillNumber)}`,
    };
  }

  if (!accountNumber) {
    throw badRequest('Account number is required for paybill payments', 'MISSING_ACCOUNT_NUMBER');
  }

  if (!/^[0-9]{4,10}$/.test(paybillNumber!)) {
    throw badRequest('Invalid paybill number format', 'INVALID_PAYBILL_NUMBER');
  }

  return {
    merchantInfo: {
      name,
      tillNumber: null,
      paybillNumber,
      accountNumber,
    },
    generateTransactionId: (prefix: 'payment' | 'transfer') => `${prefix}_${randomSuffix(paybillNumber!)}`,
    reference: `ps_ref_${randomSuffix(paybillNumber!)}`,
  };
}

async function parseRecipient(
  userId: string,
  raw: TransferRecipientPayload | undefined,
  userRepository: UserRepository,
) {
  if (!raw) {
    throw badRequest('Recipient information is required', 'MISSING_RECIPIENT');
  }

  const hasPhone = raw.phone != null && raw.phone !== '';
  const hasEmail = raw.email != null && raw.email !== '';

  if (!hasPhone && !hasEmail) {
    throw badRequest('Recipient information is required', 'MISSING_RECIPIENT');
  }

  if (hasPhone && hasEmail) {
    throw badRequest('Provide either phone or email, not both', 'CONFLICTING_RECIPIENT_INFO');
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw new HttpError(404, 'User not found', 'USER_NOT_FOUND');
  }

  let normalizedPhone: string | undefined;
  let normalizedEmail: string | undefined;

  if (hasPhone) {
    try {
      normalizedPhone = normalizeKenyanPhone(raw.phone!);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw fromValidationError(error);
      }
      throw error;
    }

    if (user.phone && normalizeKenyanPhone(user.phone) === normalizedPhone) {
      throw badRequest('Cannot transfer money to yourself', 'SELF_TRANSFER_NOT_ALLOWED');
    }
  }

  if (hasEmail) {
    try {
      normalizedEmail = normalizeEmail(raw.email!);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw fromValidationError(error);
      }
      throw error;
    }

    if (user.email && normalizeEmail(user.email) === normalizedEmail) {
      throw badRequest('Cannot transfer money to yourself', 'SELF_TRANSFER_NOT_ALLOWED');
    }
  }

  const isNewRecipient = Boolean(normalizedPhone && normalizedPhone.endsWith('999'));

  return {
    recipient: {
      phone: normalizedPhone ?? null,
      email: normalizedEmail ?? null,
      name: raw.name?.trim() ?? null,
    },
    isNewRecipient,
    generateTransactionId: (prefix: 'payment' | 'transfer') => `${prefix}_${randomSuffix(normalizedPhone ?? normalizedEmail ?? userId)}`,
  };
}

async function enforceDailyLimit(
  transactionRepository: TransactionRepository,
  userId: string,
  amount: number,
  clock: Clock,
) {
  const dayStart = startOfDay(clock.now());
  const usedToday = await transactionRepository.sumUserTransactionsForDay(userId, dayStart);
  const available = Math.max(0, DAILY_TRANSACTION_LIMIT - usedToday);
  if (amount > available) {
    throw new HttpError('400' as unknown as number, 'Daily transaction limit exceeded', 'DAILY_LIMIT_EXCEEDED', {
      daily_limit: DAILY_TRANSACTION_LIMIT,
      used_today: usedToday,
      available_today: available,
    });
  }
}

async function requireMainWallet(walletService: WalletService, userId: string) {
  const wallet = await walletService.getWallet(userId, 'main');
  if (!wallet) {
    throw new HttpError(404, 'Main wallet not found', 'WALLET_NOT_FOUND');
  }
  return wallet;
}

function determineRoundUpSkipped({
  roundUpAmount,
  roundUpTransactionId,
  originalAmount,
  initialAvailable,
}: {
  roundUpAmount: number;
  roundUpTransactionId: string | null;
  originalAmount: number;
  initialAvailable: number;
}) {
  if (roundUpAmount > 0) {
    return { skipped: false, reason: null };
  }

  if (roundUpTransactionId) {
    return { skipped: false, reason: null };
  }

  if (initialAvailable <= originalAmount) {
    return {
      skipped: true,
      reason: 'Insufficient funds for round-up',
    };
  }

  return { skipped: false, reason: null };
}

function computeRetryAfterSeconds(runAt: Date | undefined, now: Date): number | undefined {
  if (!runAt) {
    return undefined;
  }
  const seconds = Math.ceil((runAt.getTime() - now.getTime()) / 1000);
  return seconds > 0 ? seconds : 1;
}

function randomSuffix(seed: string): string {
  const base = seed.replace(/[^a-zA-Z0-9]/g, '');
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${base.slice(0, 6)}${suffix}`;
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
