import { describe, expect, it } from '@jest/globals';
import { PaymentService } from '../../api/src/services/PaymentService';
import { RoundUpRule } from '../../api/src/models/RoundUpRule';

// Utility to create a mock payment service with controlled round-up rule behaviour
const createPaymentServiceWithRule = (rule: Partial<RoundUpRule> | null) => {
  const transactionService = {
    create: jest.fn(),
    markStatus: jest.fn(),
  } as any;

  const transactionRepository = {
    update: jest.fn(),
  } as any;

  const walletService = {
    debit: jest.fn(),
    credit: jest.fn(),
    transferRoundUp: jest.fn(),
    getWallet: jest.fn().mockResolvedValue({
      id: 'main-wallet',
      userId: 'user-1',
      walletType: 'main',
      balance: 1_000_000,
      availableBalance: 1_000_000,
    }),
  };

  const paystackClient = {
    initializeTransaction: jest.fn().mockResolvedValue({
      authorizationUrl: 'https://checkout.paystack.com/ref',
      accessCode: 'AC_ref',
      reference: 'ref',
      status: 'success',
      raw: {},
    }),
    verifyTransaction: jest.fn().mockResolvedValue({
      status: 'success',
      amount: 0,
      currency: 'KES',
      paidAt: new Date(),
      channel: 'mobile_money',
      fees: 0,
      metadata: {},
      raw: {},
    }),
    createTransferRecipient: jest.fn().mockResolvedValue({ recipientCode: 'RCP_TEST', raw: {} }),
    initiateTransfer: jest.fn().mockResolvedValue({
      status: 'success',
      transferCode: 'TRF_TEST',
      reference: 'ref',
      raw: {},
    }),
    verifyTransfer: jest.fn().mockResolvedValue({ status: 'success', transferCode: 'TRF_TEST', raw: {} }),
  };

  const roundUpRuleRepository = {
    findByUserId: jest.fn().mockResolvedValue(rule),
    save: jest.fn(),
  };

  const retryQueue = {
    enqueue: jest.fn(),
  };

  return {
    paymentService: new PaymentService({
      transactionService,
      transactionRepository,
      walletService: walletService as any,
      paystackClient: paystackClient as any,
      roundUpRuleRepository: roundUpRuleRepository as any,
      retryQueue: retryQueue as any,
    }),
    transactionService,
    transactionRepository,
    walletService,
    paystackClient,
    roundUpRuleRepository,
  };
};

describe('Unit: Round-up calculation (T093)', () => {
  it('calculates round-up to nearest increment when enabled', () => {
    const rule: Partial<RoundUpRule> = {
      isEnabled: true,
      incrementType: '10',
    };

    const { paymentService } = createPaymentServiceWithRule(rule as RoundUpRule);
  const { roundUpAmount, incrementUsed } = (paymentService as any).calculateRoundUp(2373, rule as RoundUpRule);

  expect(roundUpAmount).toBe(7);
    expect(incrementUsed).toBe('10');
  });

  it('skips round-up when disabled', () => {
    const rule: Partial<RoundUpRule> = {
      isEnabled: false,
      incrementType: '10',
    };

    const { paymentService } = createPaymentServiceWithRule(rule as RoundUpRule);
  const { roundUpAmount, incrementUsed } = (paymentService as any).calculateRoundUp(5710, rule as RoundUpRule);

    expect(roundUpAmount).toBe(0);
    expect(incrementUsed).toBe('disabled');
  });

  it('uses auto settings max increment when incrementType is auto', () => {
    const rule: Partial<RoundUpRule> = {
      isEnabled: true,
      incrementType: 'auto',
      autoSettings: {
        minIncrement: 200,
        maxIncrement: 500,
        analysisPeriodDays: 30,
        lastAnalysisAt: new Date(),
      },
    };

    const { paymentService } = createPaymentServiceWithRule(rule as RoundUpRule);
  const { roundUpAmount, incrementUsed } = (paymentService as any).calculateRoundUp(4625, rule as RoundUpRule);

    expect(roundUpAmount).toBe(375);
    expect(incrementUsed).toBe('500');
  });

  it('returns zero when amount already aligns with increment', () => {
    const rule: Partial<RoundUpRule> = {
      isEnabled: true,
      incrementType: '50',
    };

    const { paymentService } = createPaymentServiceWithRule(rule as RoundUpRule);
  const { roundUpAmount } = (paymentService as any).calculateRoundUp(7500, rule as RoundUpRule);

    expect(roundUpAmount).toBe(0);
  });
});
