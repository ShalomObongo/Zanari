/**
 * Wallet HTTP route handlers.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../models/base';
import { Transaction } from '../models/Transaction';
import { AuthService } from '../services/AuthService';
import { TransactionService } from '../services/TransactionService';
import { WalletService } from '../services/WalletService';
import { Clock, Logger, NullLogger, SystemClock } from '../services/types';
import { HttpError, badRequest, fromValidationError, notFound } from './errors';
import { ensureAuthenticated } from './handler';
import { ok } from './responses';
import { serializeWallet } from './serializers';
import { HttpRequest } from './types';
import { normalizeKenyanPhone, requireNumber, requireString } from './validation';

interface WithdrawBody {
  amount?: number;
  pin_token?: string;
  mpesa_phone?: string;
}

export interface WalletRouteDependencies {
  walletService: WalletService;
  transactionService: TransactionService;
  authService: AuthService;
  clock?: Clock;
  logger?: Logger;
}

const MIN_WITHDRAWAL_AMOUNT = 100; // cents

export function createWalletRoutes({
  walletService,
  transactionService,
  authService,
  clock = new SystemClock(),
  logger = NullLogger,
}: WalletRouteDependencies) {
  return {
    listWallets: async (request: HttpRequest) => {
      ensureAuthenticated(request);
      const wallets = await walletService.listWallets(request.userId);
      return ok({ wallets: wallets.map(serializeWallet) });
    },

    withdraw: async (request: HttpRequest<WithdrawBody, { walletId: string }>) => {
      ensureAuthenticated(request);

      const walletId = requireString(request.params.walletId, 'walletId path parameter is required', 'INVALID_WALLET_ID');

      const rawAmount = requireNumber(
        request.body?.amount,
        'Amount must be a positive integer in cents',
        'INVALID_AMOUNT_FORMAT',
      );
      if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
        throw badRequest('Amount must be a positive integer in cents', 'INVALID_AMOUNT_FORMAT');
      }
      if (rawAmount < MIN_WITHDRAWAL_AMOUNT) {
        throw badRequest('Minimum withdrawal amount is KES 1.00', 'AMOUNT_TOO_LOW');
      }

      const pinToken = request.body?.pin_token;
      if (!pinToken) {
        throw badRequest('PIN token is required', 'MISSING_PIN_TOKEN');
      }
      if (!/^txn_[a-zA-Z0-9]+$/.test(pinToken)) {
        throw badRequest('Invalid PIN token format', 'INVALID_PIN_TOKEN_FORMAT');
      }
      const tokenValid = await authService.validatePinToken(request.userId, pinToken);
      if (!tokenValid) {
        throw new HttpError(401, 'PIN token expired', 'PIN_TOKEN_EXPIRED');
      }

      const mpesaPhoneRaw = request.body?.mpesa_phone;
      if (!mpesaPhoneRaw) {
        throw badRequest('M-Pesa phone number is required', 'MISSING_MPESA_PHONE');
      }
      const mpesaPhone = normalizeKenyanPhone(mpesaPhoneRaw);

      let wallet;
      try {
        wallet = await walletService.requireWalletById(request.userId, walletId);
      } catch {
        throw notFound('Wallet not found', 'WALLET_NOT_FOUND');
      }

      if (wallet.availableBalance < rawAmount) {
        throw new HttpError(402, 'Insufficient funds', 'INSUFFICIENT_FUNDS', {
          available_balance: wallet.availableBalance,
        });
      }

      const lockedUntil = wallet.withdrawalRestrictions?.lockedUntil;
      const now = clock.now();
      if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
        throw new HttpError(403, 'Withdrawals currently locked for this wallet', 'WALLET_LOCKED', {
          locked_until: lockedUntil.toISOString(),
        });
      }

      const settlementDelay = wallet.withdrawalRestrictions?.minSettlementDelayMinutes ??
        (wallet.walletType === 'savings' ? 5 : 2);
      const estimatedCompletion = new Date(now.getTime() + settlementDelay * 60 * 1000);

      try {
        await walletService.debit({ userId: request.userId, walletType: wallet.walletType, amount: rawAmount });

        const transactionId = `txn_${randomUUID().replace(/-/g, '')}`;
        const transaction = await transactionService.create({
          id: transactionId,
          userId: request.userId,
          type: 'withdrawal',
          amount: rawAmount,
          category: 'transfer',
          autoCategorized: false,
          metadata: {
            fromWalletId: wallet.id,
            paymentMethod: 'mpesa',
            description: `Withdrawal to ${mpesaPhone}`,
            externalReference: `mpesa:${mpesaPhone}`,
          } as Partial<Transaction>,
        });

        await authService.invalidatePinToken(pinToken);

        logger.info('Wallet withdrawal initiated', {
          userId: request.userId,
          walletId: wallet.id,
          amount: rawAmount,
          transactionId: transaction.id,
          settlementDelay,
        });

        return ok({
          transaction_id: transaction.id,
          settlement_delay_minutes: settlementDelay,
          estimated_completion: estimatedCompletion.toISOString(),
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },
  };
}
