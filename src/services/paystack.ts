import { Linking } from 'react-native';
import apiClient, { ApiError } from '@/services/api';
import PAYSTACK_CONFIG, {
  PaystackUtils,
  PAYSTACK_ERROR_CODES,
  PaystackErrorCode,
  RETRY_CONFIG,
  validatePaystackConfig,
} from '@/config/paystack';

/**
 * Shapes returned by backend payment endpoints
 */
interface MerchantPaymentResponse {
  payment_transaction_id: string;
  round_up_transaction_id: string | null;
  total_charged: number;
  round_up_amount: number;
  paystack_reference: string;
  paystack_access_code: string;
  paystack_authorization_url: string;
  status?: 'pending' | 'completed';
  retry_after?: number;
  round_up_skipped: boolean;
  round_up_skip_reason?: string | null;
}

interface TransferPaymentResponse {
  transfer_transaction_id: string;
  round_up_transaction_id: string | null;
  total_charged: number;
  round_up_amount: number;
  paystack_transfer_reference: string;
  paystack_recipient_code: string;
  estimated_completion: string | null;
  round_up_skipped: boolean;
  round_up_skip_reason?: string | null;
  status?: 'pending' | 'completed';
  retry_after?: number;
  recipient_created: boolean;
}

export interface MerchantPaymentParams {
  amountKes: number;
  pinToken: string;
  merchant: {
    name: string;
    tillNumber?: string;
    paybillNumber?: string;
    accountNumber?: string;
  };
  description?: string;
}

export interface TransferPaymentParams {
  amountKes: number;
  pinToken: string;
  recipient: {
    phone?: string;
    email?: string;
    name?: string;
  };
  description?: string;
}

export interface PaystackCheckoutSession {
  accessCode: string;
  authorizationUrl: string;
  reference: string;
  publicKey: string;
  amount: number;
}

export interface MerchantPaymentResult extends MerchantPaymentResponse {
  amount_kes: number;
  checkout: PaystackCheckoutSession;
}

export interface TransferPaymentResult extends TransferPaymentResponse {
  amount_kes: number;
}

type PaystackServiceErrorCode =
  | PaystackErrorCode
  | 'invalid_amount'
  | 'invalid_configuration'
  | 'merchant_info_incomplete'
  | 'recipient_info_incomplete';

export class PaystackServiceError extends Error {
  constructor(
    message: string,
    public readonly code: PaystackServiceErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PaystackServiceError';
  }
}

const ensureConfiguration = () => {
  const valid = validatePaystackConfig();
  if (!valid) {
    throw new PaystackServiceError(
      'Paystack configuration is invalid. Please verify your public key.',
      'invalid_configuration',
    );
  }
};

const normalizeAmount = (amountKes: number): number => {
  const amount = PaystackUtils.kesToCents(amountKes);
  const validation = PaystackUtils.validateAmount(amount);
  if (!validation.valid) {
    throw new PaystackServiceError(validation.error ?? 'Invalid amount specified', 'invalid_amount');
  }
  return amount;
};

const buildCheckoutSession = (
  authorizationUrl: string,
  accessCode: string,
  reference: string,
  amountCents: number,
): PaystackCheckoutSession => ({
  authorizationUrl,
  accessCode,
  reference,
  publicKey: PAYSTACK_CONFIG.publicKey,
  amount: amountCents,
});

const toMerchantPayload = (params: MerchantPaymentParams, amount: number) => {
  const { merchant } = params;
  const hasTill = merchant.tillNumber && merchant.tillNumber.trim().length > 0;
  const hasPaybill = merchant.paybillNumber && merchant.paybillNumber.trim().length > 0;

  if (!hasTill && !hasPaybill) {
    throw new PaystackServiceError(
      'Merchant information requires either till number or paybill details.',
      'merchant_info_incomplete',
    );
  }

  const merchantInfo: {
    name: string;
    till_number?: string;
    paybill_number?: string;
    account_number?: string;
  } = {
    name: merchant.name.trim(),
  };

  if (hasTill) {
    merchantInfo.till_number = merchant.tillNumber!.trim();
  } else {
    merchantInfo.paybill_number = merchant.paybillNumber!.trim();
    if (!merchant.accountNumber || merchant.accountNumber.trim().length === 0) {
      throw new PaystackServiceError(
        'Account number is required when specifying a paybill number.',
        'merchant_info_incomplete',
      );
    }
    merchantInfo.account_number = merchant.accountNumber.trim();
  }

  return {
    amount,
    pin_token: params.pinToken,
    merchant_info: merchantInfo,
    description: params.description?.trim() ?? undefined,
  };
};

const toTransferPayload = (params: TransferPaymentParams, amount: number) => {
  const { recipient } = params;
  const hasPhone = recipient.phone && recipient.phone.trim().length > 0;
  const hasEmail = recipient.email && recipient.email.trim().length > 0;

  if (!hasPhone && !hasEmail) {
    throw new PaystackServiceError(
      'Recipient information requires a phone number or an email address.',
      'recipient_info_incomplete',
    );
  }

  return {
    amount,
    pin_token: params.pinToken,
    recipient: {
      phone: hasPhone ? recipient.phone!.trim() : undefined,
      email: hasEmail ? recipient.email!.trim() : undefined,
      name: recipient.name?.trim(),
    },
    description: params.description?.trim() ?? undefined,
  };
};

const mapApiError = (error: ApiError): PaystackServiceError => {
  const detailCode = error.code ?? undefined;
  let code: PaystackServiceErrorCode = 'invalid_amount';

  if (typeof detailCode === 'string') {
    if (detailCode in PAYSTACK_ERROR_CODES) {
      code = PAYSTACK_ERROR_CODES[detailCode as keyof typeof PAYSTACK_ERROR_CODES];
    } else {
      code = detailCode.toLowerCase() as PaystackServiceErrorCode;
    }
  } else if (error.status === 402) {
    code = PAYSTACK_ERROR_CODES.INSUFFICIENT_FUNDS;
  } else if (error.status >= 500 || error.status === 408) {
    code = PAYSTACK_ERROR_CODES.NETWORK_ERROR;
  }

  return new PaystackServiceError(error.message, code, error);
};

export const PaystackService = {
  async initializeMerchantPayment(params: MerchantPaymentParams): Promise<MerchantPaymentResult> {
    ensureConfiguration();
    const amount = normalizeAmount(params.amountKes);
    const payload = toMerchantPayload(params, amount);

    try {
      const response = await apiClient.post<MerchantPaymentResponse>('/payments/merchant', payload);
      return {
        ...response,
        amount_kes: params.amountKes,
        checkout: buildCheckoutSession(
          response.paystack_authorization_url,
          response.paystack_access_code,
          response.paystack_reference,
          amount,
        ),
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw mapApiError(error);
      }
      throw error;
    }
  },

  async initiateTransfer(params: TransferPaymentParams): Promise<TransferPaymentResult> {
    ensureConfiguration();
    const amount = normalizeAmount(params.amountKes);
    const payload = toTransferPayload(params, amount);

    try {
      const response = await apiClient.post<TransferPaymentResponse>('/payments/transfer', payload);
      return {
        ...response,
        amount_kes: params.amountKes,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw mapApiError(error);
      }
      throw error;
    }
  },

  async openCheckout(checkout: PaystackCheckoutSession) {
    ensureConfiguration();
    const supported = await Linking.canOpenURL(checkout.authorizationUrl);
    if (!supported) {
      throw new PaystackServiceError(
        'Unable to open Paystack checkout. Please update your device or try again.',
        PAYSTACK_ERROR_CODES.NETWORK_ERROR,
      );
    }
    await Linking.openURL(checkout.authorizationUrl);
  },

  getRetryDelay(attempt: number) {
    return RETRY_CONFIG.getDelayForAttempt(attempt);
  },
};

export type PaystackServiceType = typeof PaystackService;

export default PaystackService;
