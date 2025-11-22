import { randomUUID } from 'node:crypto';
import { SavingsInvestmentService } from '../../api/src/services/SavingsInvestmentService';
import { SavingsInvestmentPreference } from '../../api/src/models/SavingsInvestmentPreference';
import { SavingsInvestmentPosition } from '../../api/src/models/SavingsInvestmentPosition';
import { WalletService } from '../../api/src/services/WalletService';
import { TransactionService } from '../../api/src/services/TransactionService';
import { Clock, SavingsInvestmentPreferenceRepository, SavingsInvestmentPositionRepository, InvestmentProductRepository } from '../../api/src/services/types';
import { InvestmentProduct } from '../../api/src/models/InvestmentProduct';

// Mock Clock
class MockClock implements Clock {
  private currentTime: Date;

  constructor(startTime: Date) {
    this.currentTime = startTime;
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  advance(ms: number) {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }
}

// Mock Repositories
class MockPreferenceRepository implements SavingsInvestmentPreferenceRepository {
  private store = new Map<string, SavingsInvestmentPreference>();

  async findByUserId(userId: string): Promise<SavingsInvestmentPreference | null> {
    return this.store.get(userId) || null;
  }

  async save(preference: SavingsInvestmentPreference): Promise<SavingsInvestmentPreference> {
    this.store.set(preference.userId, preference);
    return preference;
  }

  async getOrCreateDefault(userId: string): Promise<SavingsInvestmentPreference> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    
    const created: SavingsInvestmentPreference = {
      userId,
      autoInvestEnabled: false,
      targetAllocationPct: 0,
      preferredProductCode: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.save(created);
  }
}

class MockPositionRepository implements SavingsInvestmentPositionRepository {
  private store = new Map<string, SavingsInvestmentPosition>();

  async findByUserId(userId: string): Promise<SavingsInvestmentPosition | null> {
    return this.store.get(userId) || null;
  }

  async save(position: SavingsInvestmentPosition): Promise<SavingsInvestmentPosition> {
    this.store.set(position.userId, position);
    return position;
  }

  async findAllUserIds(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

class MockProductRepository implements InvestmentProductRepository {
  async findByCode(code: string): Promise<InvestmentProduct | null> {
    return {
      id: 'prod-1',
      code,
      name: 'Test Product',
      annualYieldBps: 1200,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async findAllActive(): Promise<InvestmentProduct[]> {
    return [{
      id: 'prod-1',
      code: 'default',
      name: 'Test Product',
      annualYieldBps: 1200,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
  }
}

describe('SavingsInvestmentService', () => {
  let service: SavingsInvestmentService;
  let walletService: jest.Mocked<WalletService>;
  let transactionService: jest.Mocked<TransactionService>;
  let preferenceRepo: MockPreferenceRepository;
  let positionRepo: MockPositionRepository;
  let productRepo: MockProductRepository;
  let clock: MockClock;
  const userId = randomUUID();

  beforeEach(() => {
    walletService = {
      getWallet: jest.fn(),
      debit: jest.fn(),
      credit: jest.fn(),
    } as any;

    transactionService = {
      create: jest.fn(),
    } as any;

    preferenceRepo = new MockPreferenceRepository();
    positionRepo = new MockPositionRepository();
    productRepo = new MockProductRepository();
    clock = new MockClock(new Date('2025-01-01T00:00:00Z'));

    service = new SavingsInvestmentService({
      walletService,
      transactionService,
      preferenceRepository: preferenceRepo,
      positionRepository: positionRepo,
      productRepository: productRepo,
      clock,
      minInvestmentAmount: 500, // 5 KES
    });
  });

  describe('getSummary', () => {
    it('should return initial summary with zero values', async () => {
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 10000,
        availableBalance: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const summary = await service.getSummary(userId);

      expect(summary.investedAmount).toBe(0);
      expect(summary.accruedInterest).toBe(0);
      expect(summary.savingsAvailableBalance).toBe(10000);
      expect(summary.totalValue).toBe(10000);
    });
  });

  describe('allocate', () => {
    it('should allocate funds from savings to investment', async () => {
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 10000,
        availableBalance: 10000,
      } as any);

      await service.allocate(userId, 5000);

      expect(walletService.debit).toHaveBeenCalledWith({
        userId,
        walletType: 'savings',
        amount: 5000,
      });

      expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        type: 'investment_allocation',
        amount: 5000,
        category: 'investment',
        skipLimits: true,
      }));

      const position = await positionRepo.findByUserId(userId);
      expect(position?.investedAmount).toBe(5000);
    });

    it('should throw if insufficient funds', async () => {
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 1000,
        availableBalance: 1000,
      } as any);

      await expect(service.allocate(userId, 5000)).rejects.toThrow('Insufficient funds');
    });

    it('should throw if amount is below minimum', async () => {
      await expect(service.allocate(userId, 100)).rejects.toThrow('Minimum investment amount');
    });
  });

  describe('redeem', () => {
    it('should redeem funds from investment to savings', async () => {
      // Setup initial position
      await positionRepo.save({
        id: 'pos-1',
        userId,
        productCode: 'default',
        investedAmount: 5000,
        accruedInterest: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccruedAt: new Date(),
      });

      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 5000,
        availableBalance: 5000,
      } as any);

      await service.redeem(userId, 2000);

      expect(walletService.credit).toHaveBeenCalledWith({
        userId,
        walletType: 'savings',
        amount: 2000,
      });

      expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        type: 'investment_redemption',
        amount: 2000,
        category: 'investment',
        skipLimits: true,
      }));

      const position = await positionRepo.findByUserId(userId);
      expect(position?.investedAmount).toBe(3000);
    });

    it('should throw if redeeming more than invested', async () => {
      await positionRepo.save({
        id: 'pos-1',
        userId,
        productCode: 'default',
        investedAmount: 1000,
        accruedInterest: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccruedAt: new Date(),
      });

      await expect(service.redeem(userId, 2000)).rejects.toThrow('exceeds invested balance');
    });
  });

  describe('interest accrual', () => {
    it('should accrue interest over time', async () => {
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 0,
        availableBalance: 0,
      } as any);

      // Invest 10,000 cents (100 KES)
      // 12% APY = 12 KES/year = 1200 cents/year
      // 1 month = ~100 cents
      
      await positionRepo.save({
        id: 'pos-1',
        userId,
        productCode: 'default',
        investedAmount: 10000,
        accruedInterest: 0,
        createdAt: clock.now(),
        updatedAt: clock.now(),
        lastAccruedAt: clock.now(),
      });

      // Advance 1 month (approx)
      const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
      clock.advance(oneMonthMs);

      const summary = await service.getSummary(userId);
      
      // Expected interest: (10000 * 1200 * oneMonthMs) / (10000 * 365 * 24 * 60 * 60 * 1000)
      // = (10000 * 0.12 * (30/365))
      // = 1200 * 0.08219...
      // = ~98.63 -> floor to 98
      
      expect(summary.accruedInterest).toBeGreaterThan(95);
      expect(summary.accruedInterest).toBeLessThan(105);
    });
  });

  describe('autoAllocateSurplus', () => {
    it('should auto-invest when balance exceeds target allocation', async () => {
      // Setup: 50% target allocation
      await preferenceRepo.save({
        userId,
        autoInvestEnabled: true,
        targetAllocationPct: 50,
        preferredProductCode: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Wallet has 10,000, Invested has 0. Total = 10,000.
      // Target invested = 5,000.
      // Should invest 5,000.
      
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 10000,
        availableBalance: 10000,
      } as any);

      await service.autoAllocateSurplus(userId);

      expect(walletService.debit).toHaveBeenCalledWith({
        userId,
        walletType: 'savings',
        amount: 5000,
      });

      expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        type: 'investment_allocation',
        amount: 5000,
        category: 'investment',
        skipLimits: true,
      }));

      const position = await positionRepo.findByUserId(userId);
      expect(position?.investedAmount).toBe(5000);
    });

    it('should not invest if disabled', async () => {
      await preferenceRepo.save({
        userId,
        autoInvestEnabled: false,
        targetAllocationPct: 50,
        preferredProductCode: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 10000,
        availableBalance: 10000,
      } as any);

      await service.autoAllocateSurplus(userId);

      expect(walletService.debit).not.toHaveBeenCalled();
    });

    it('should respect minimum investment amount', async () => {
       // Setup: 50% target allocation
       await preferenceRepo.save({
        userId,
        autoInvestEnabled: true,
        targetAllocationPct: 50,
        preferredProductCode: 'default',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Wallet has 1000, Invested has 900. Total = 1900.
      // Target invested = 950.
      // Delta = 50. Min investment = 500.
      // Should NOT invest.
      
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 1000,
        availableBalance: 1000,
      } as any);

      await positionRepo.save({
        id: 'pos-1',
        userId,
        productCode: 'default',
        investedAmount: 900,
        accruedInterest: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccruedAt: new Date(),
      });

      await service.autoAllocateSurplus(userId);

      expect(walletService.debit).not.toHaveBeenCalled();
    });
  });

  describe('claimAccruedInterest', () => {
    it('should claim accrued interest and credit savings wallet', async () => {
      // Setup: Position with accrued interest
      await positionRepo.save({
        id: 'pos-1',
        userId,
        productCode: 'default',
        investedAmount: 10000,
        accruedInterest: 500, // 5 KES
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccruedAt: new Date(),
      });

      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 0,
        availableBalance: 0,
      } as any);

      await service.claimAccruedInterest(userId);

      expect(walletService.credit).toHaveBeenCalledWith({
        userId,
        walletType: 'savings',
        amount: 500,
      });

      expect(transactionService.create).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        type: 'interest_payout',
        amount: 500,
        category: 'investment',
        skipLimits: true,
      }));

      const position = await positionRepo.findByUserId(userId);
      expect(position?.accruedInterest).toBe(0);
    });

    it('should do nothing if no accrued interest', async () => {
      await positionRepo.save({
        id: 'pos-1',
        userId,
        productCode: 'default',
        investedAmount: 10000,
        accruedInterest: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccruedAt: new Date(),
      });

      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 0,
        availableBalance: 0,
      } as any);

      await service.claimAccruedInterest(userId);

      expect(walletService.credit).not.toHaveBeenCalled();
    });
  });

  describe('updatePreference', () => {
    it('should update preferences and return summary', async () => {
      walletService.getWallet.mockResolvedValue({
        id: 'wallet-1',
        userId,
        walletType: 'savings',
        balance: 0,
        availableBalance: 0,
      } as any);

      const summary = await service.updatePreference(userId, {
        autoInvestEnabled: true,
        targetAllocationPct: 75,
      });

      expect(summary.autoInvestEnabled).toBe(true);
      expect(summary.targetAllocationPct).toBe(75);

      const stored = await preferenceRepo.findByUserId(userId);
      expect(stored?.autoInvestEnabled).toBe(true);
      expect(stored?.targetAllocationPct).toBe(75);
    });
  });
});