# Zanari Testing Strategy and Data Management

## Overview

This document outlines the comprehensive testing strategy and test data management approach for the Zanari project. It ensures consistent testing across development, staging, and production environments while maintaining data security and privacy.

## Testing Pyramid

### 1. Unit Tests (70%)
- **Purpose:** Test individual functions and components in isolation
- **Tools:** Jest, React Native Testing Library
- **Coverage Target:** 80% code coverage
- **Execution:** Fast (seconds), run on every commit

### 2. Integration Tests (20%)
- **Purpose:** Test interactions between components and services
- **Tools:** Jest, Supertest, React Native Testing Library
- **Coverage Target:** 50% integration coverage
- **Execution:** Medium speed (minutes), run on pull requests

### 3. End-to-End Tests (10%)
- **Purpose:** Test complete user flows from UI to backend
- **Tools:** Detox, Supabase Test Harness
- **Coverage Target:** Critical user paths only
- **Execution:** Slow (10+ minutes), run nightly and before releases

## Test Environment Strategy

### Development Environment
- **Database:** Local Supabase instance
- **Data:** Fresh seed data on each run
- **API:** Local development server
- **Mobile:** Local React Native app
- **Reset:** Full database reset between test runs

### Staging Environment
- **Database:** Supabase staging project
- **Data:** Anonymized production-like data
- **API:** Staging deployment
- **Mobile:** TestFlight/Play Store beta
- **Reset:** Weekly refresh with sanitized data

### Production Environment
- **Database:** Production Supabase instance
- **Data:** Real user data (read-only for testing)
- **API:** Production deployment
- **Mobile:** App Store/Play Store production
- **Reset:** Never reset production data

## Test Data Management

### 1. Data Classification

#### Test Data Categories
- **Synthetic Data:** Generated fake data for testing
- **Anonymized Data:** Production data with PII removed
- **Mock Data:** Hardcoded test data for specific scenarios
- **Seed Data:** Initial database state for development

#### Data Sensitivity Levels
- **Level 1 (Public):** Non-sensitive app data (app settings, UI text)
- **Level 2 (Internal):** Business data (transactions, goals - anonymized)
- **Level 3 (Confidential):** User PII (phone numbers, PINs - synthetic only)
- **Level 4 (Secret):** Encryption keys, API credentials - never in test data

### 2. Test Data Generation

#### Synthetic Data Generation
```typescript
// services/test-data-generator.ts
import { faker } from '@faker-js/faker';

export class TestDataGenerator {
  static generateUser(override = {}) {
    return {
      phone_number: faker.phone.number('+2547########'),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      email: faker.internet.email(),
      pin_hash: this.generateTestPin(),
      created_at: new Date(),
      ...override,
    };
  }

  static generateTransaction(userId: string, override = {}) {
    return {
      user_id: userId,
      amount: faker.number.float({ min: 10, max: 10000, precision: 2 }),
      type: faker.helpers.arrayElement(['deposit', 'withdrawal', 'savings']),
      description: faker.lorem.sentence(),
      status: 'completed',
      created_at: faker.date.recent(),
      ...override,
    };
  }

  static generateGoal(userId: string, override = {}) {
    return {
      user_id: userId,
      name: faker.lorem.words(3),
      target_amount: faker.number.float({ min: 1000, max: 100000, precision: 2 }),
      current_amount: faker.number.float({ min: 0, max: 50000, precision: 2 }),
      target_date: faker.date.future(),
      icon: faker.helpers.arrayElement(['🏠', '🚗', '✈️', '📱', '💰']),
      created_at: faker.date.recent(),
      ...override,
    };
  }

  private static generateTestPin(): string {
    // Test PIN - always use the same hash for testing
    return bcrypt.hashSync('1234', 10);
  }
}
```

#### Seed Data Management
```typescript
// scripts/seed-database.ts
import { createClient } from '@supabase/supabase-js';
import { TestDataGenerator } from '../services/test-data-generator';

export class DatabaseSeeder {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  async seedDevelopmentData() {
    console.log('Seeding development database...');

    // Clear existing data
    await this.clearDatabase();

    // Generate test users
    const users = await this.generateTestUsers(10);

    // Generate transactions for each user
    for (const user of users) {
      await this.generateUserTransactions(user.id, 20);
      await this.generateUserGoals(user.id, 3);
    }

    console.log('Development data seeded successfully');
  }

  async seedProductionLikeData() {
    console.log('Seeding production-like data...');

    // Generate larger dataset for staging
    const users = await this.generateTestUsers(1000);

    for (const user of users) {
      await this.generateUserTransactions(user.id, 50);
      await this.generateUserGoals(user.id, 5);
    }

    console.log('Production-like data seeded successfully');
  }

  private async clearDatabase() {
    // Clear tables in correct order to respect foreign keys
    await this.supabase.from('transactions').delete().neq('id', 0);
    await this.supabase.from('savings_goals').delete().neq('id', 0);
    await this.supabase.from('user_profiles').delete().neq('id', 0);
  }

  private async generateTestUsers(count: number) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const userData = TestDataGenerator.generateUser();
      const { data, error } = await this.supabase.auth.admin.createUser({
        email: userData.email,
        phone: userData.phone_number,
        password: 'test1234',
        email_confirm: true,
      });

      if (!error) {
        await this.supabase.from('user_profiles').insert([{
          id: data.user.id,
          ...userData,
        }]);
        users.push(data.user);
      }
    }
    return users;
  }

  private async generateUserTransactions(userId: string, count: number) {
    const transactions = [];
    for (let i = 0; i < count; i++) {
      transactions.push(TestDataGenerator.generateTransaction(userId));
    }
    await this.supabase.from('transactions').insert(transactions);
  }

  private async generateUserGoals(userId: string, count: number) {
    const goals = [];
    for (let i = 0; i < count; i++) {
      goals.push(TestDataGenerator.generateGoal(userId));
    }
    await this.supabase.from('savings_goals').insert(goals);
  }
}
```

### 3. Test Data Utilities

#### Test Database Manager
```typescript
// services/test-database-manager.ts
export class TestDatabaseManager {
  private static instance: TestDatabaseManager;
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  static getInstance(): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager();
    }
    return TestDatabaseManager.instance;
  }

  async setupTestDatabase() {
    // Create test-specific schema
    await this.createTestSchema();

    // Run migrations
    await this.runMigrations();

    // Seed test data
    await this.seedTestData();
  }

  async cleanupTestDatabase() {
    // Clean up test data
    await this.cleanupTestData();

    // Drop test schema
    await this.dropTestSchema();
  }

  async createTestUser(overrides = {}) {
    const userData = TestDataGenerator.generateUser(overrides);

    const { data, error } = await this.supabase.auth.admin.createUser({
      email: userData.email,
      phone: userData.phone_number,
      password: 'test1234',
      email_confirm: true,
    });

    if (!error) {
      await this.supabase.from('user_profiles').insert([{
        id: data.user.id,
        ...userData,
      }]);
    }

    return data.user;
  }

  async createTestTransaction(userId: string, overrides = {}) {
    const transaction = TestDataGenerator.generateTransaction(userId, overrides);
    const { data, error } = await this.supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();

    return data;
  }

  async createTestGoal(userId: string, overrides = {}) {
    const goal = TestDataGenerator.generateGoal(userId, overrides);
    const { data, error } = await this.supabase
      .from('savings_goals')
      .insert([goal])
      .select()
      .single();

    return data;
  }

  private async createTestSchema() {
    // Create test-specific database schema
    await this.supabase.rpc('create_test_schema');
  }

  private async runMigrations() {
    // Run database migrations
    await this.supabase.rpc('run_migrations');
  }

  private async seedTestData() {
    // Seed basic test data
    await this.supabase.rpc('seed_test_data');
  }

  private async cleanupTestData() {
    // Clean up test data
    await this.supabase.rpc('cleanup_test_data');
  }

  private async dropTestSchema() {
    // Drop test schema
    await this.supabase.rpc('drop_test_schema');
  }
}
```

#### Test Data Builders
```typescript
// test-data/builders/user-builder.ts
export class UserBuilder {
  private user: any;

  constructor() {
    this.user = {
      phone_number: '+254712345678',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      pin_hash: bcrypt.hashSync('1234', 10),
      created_at: new Date(),
    };
  }

  withPhone(phone: string): UserBuilder {
    this.user.phone_number = phone;
    return this;
  }

  withName(firstName: string, lastName: string): UserBuilder {
    this.user.first_name = firstName;
    this.user.last_name = lastName;
    return this;
  }

  withEmail(email: string): UserBuilder {
    this.user.email = email;
    return this;
  }

  withPin(pin: string): UserBuilder {
    this.user.pin_hash = bcrypt.hashSync(pin, 10);
    return this;
  }

  build(): any {
    return { ...this.user };
  }
}
```

## Testing Environment Configuration

### 1. Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  setupFiles: ['./jest.setup.js'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/',
  ],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
};
```

### 2. Test Setup and Teardown
```typescript
// jest.setup.js
import { TestDatabaseManager } from './services/test-database-manager';

// Global test database manager
global.testDb = TestDatabaseManager.getInstance();

// Setup before all tests
beforeAll(async () => {
  await global.testDb.setupTestDatabase();
});

// Cleanup after all tests
afterAll(async () => {
  await global.testDb.cleanupTestDatabase();
});

// Cleanup after each test
afterEach(async () => {
  // Clean up test data between tests
  await global.testDb.cleanupTestData();
});
```

## Test Scenarios

### 1. Unit Test Examples

#### User Service Tests
```typescript
// __tests__/services/user-service.test.ts
import { UserService } from '../services/user-service';
import { TestDatabaseManager } from '../services/test-database-manager';

describe('UserService', () => {
  let userService: UserService;
  let testDb: TestDatabaseManager;

  beforeEach(() => {
    userService = new UserService();
    testDb = TestDatabaseManager.getInstance();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        phone_number: '+254712345678',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        pin: '1234',
      };

      const user = await userService.createUser(userData);

      expect(user).toBeDefined();
      expect(user.phone_number).toBe(userData.phone_number);
      expect(user.first_name).toBe(userData.first_name);
    });

    it('should throw error for duplicate phone number', async () => {
      const userData = {
        phone_number: '+254712345678',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        pin: '1234',
      };

      // Create first user
      await userService.createUser(userData);

      // Try to create duplicate
      await expect(userService.createUser(userData))
        .rejects
        .toThrow('Phone number already exists');
    });
  });
});
```

#### Round-up Service Tests
```typescript
// __tests__/services/roundup-service.test.ts
import { RoundupService } from '../services/roundup-service';

describe('RoundupService', () => {
  let roundupService: RoundupService;

  beforeEach(() => {
    roundupService = new RoundupService();
  });

  describe('calculateRoundup', () => {
    it('should calculate round-up amount correctly', () => {
      const testCases = [
        { amount: 147, expected: 3 },
        { amount: 150, expected: 0 },
        { amount: 99, expected: 1 },
        { amount: 10, expected: 0 },
        { amount: 1, expected: 9 },
      ];

      testCases.forEach(({ amount, expected }) => {
        const result = roundupService.calculateRoundup(amount);
        expect(result).toBe(expected);
      });
    });

    it('should return 0 for negative amounts', () => {
      const result = roundupService.calculateRoundup(-50);
      expect(result).toBe(0);
    });

    it('should return 0 for zero amount', () => {
      const result = roundupService.calculateRoundup(0);
      expect(result).toBe(0);
    });
  });
});
```

### 2. Integration Test Examples

#### M-PESA Integration Tests
```typescript
// __tests__/integration/mpesa-integration.test.ts
import { MpesaService } from '../services/mpesa-service';
import { TestDatabaseManager } from '../services/test-database-manager';

describe('M-PESA Integration', () => {
  let mpesaService: MpesaService;
  let testDb: TestDatabaseManager;

  beforeAll(() => {
    mpesaService = new MpesaService();
    testDb = TestDatabaseManager.getInstance();
  });

  describe('processRoundupTransaction', () => {
    it('should process M-PESA transaction and create round-up savings', async () => {
      // Create test user
      const user = await testDb.createTestUser();

      // Simulate M-PESA transaction
      const mpesaTransaction = {
        TransID: 'TEST123',
        TransAmount: '147.00',
        MSISDN: user.phone_number,
        TransTime: '20240101120000',
        BillRefNumber: 'TEST',
      };

      // Process transaction
      const result = await mpesaService.processRoundupTransaction(mpesaTransaction);

      // Verify round-up was created
      expect(result.success).toBe(true);
      expect(result.roundupAmount).toBe(3);

      // Verify database records
      const transactions = await testDb.getUserTransactions(user.id);
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(3);
      expect(transactions[0].type).toBe('savings');
    });
  });
});
```

### 3. E2E Test Examples

#### Mobile App E2E Tests
```typescript
// e2e/registration.test.ts
import { by, element } from 'detox';

describe('Registration Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should complete registration successfully', async () => {
    // Navigate to registration
    await element(by.id('get-started-button')).tap();

    // Enter phone number
    await element(by.id('phone-input')).typeText('+254712345678');
    await element(by.id('continue-button')).tap();

    // Wait for OTP screen
    await expect(element(by.id('otp-input'))).toBeVisible();

    // Enter OTP (using test OTP)
    await element(by.id('otp-input')).typeText('123456');
    await element(by.id('verify-button')).tap();

    // Set PIN
    await element(by.id('pin-input')).typeText('1234');
    await element(by.id('confirm-pin-input')).typeText('1234');
    await element(by.id('create-pin-button')).tap();

    // Verify dashboard is shown
    await expect(element(by.id('dashboard-welcome'))).toBeVisible();
  });
});
```

## Test Data Security

### 1. Data Protection Measures

#### Anonymization Rules
```typescript
// services/data-anonymizer.ts
export class DataAnonymizer {
  static anonymizeUser(user: any): any {
    return {
      ...user,
      phone_number: this.anonymizePhone(user.phone_number),
      email: this.anonymizeEmail(user.email),
      first_name: this.anonymizeName(user.first_name),
      last_name: this.anonymizeName(user.last_name),
      pin_hash: this.anonymizePin(user.pin_hash),
    };
  }

  static anonymizePhone(phone: string): string {
    return '+2547****' + phone.slice(-4);
  }

  static anonymizeEmail(email: string): string {
    const [local, domain] = email.split('@');
    return local[0] + '***@' + domain;
  }

  static anonymizeName(name: string): string {
    return name[0] + '***';
  }

  static anonymizePin(pinHash: string): string {
    return '**********';
  }
}
```

#### Data Encryption for Test Data
```typescript
// services/test-data-encryption.ts
import crypto from 'crypto';

export class TestDataEncryption {
  private static algorithm = 'aes-256-gcm';
  private static key = crypto.scryptSync(process.env.TEST_DATA_KEY!, 'salt', 32);
  private static ivLength = 16;

  static encrypt(text: string): { encrypted: string; tag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      tag: tag.toString('hex'),
    };
  }

  static decrypt(encrypted: string, tag: string): string {
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 2. Access Control

#### Test Data Access Policies
- **Development:** Full access to synthetic test data
- **Staging:** Limited access to anonymized production data
- **Production:** Read-only access for debugging, never modify production data
- **External:** No access to any test data containing PII

## Continuous Testing

### 1. CI/CD Pipeline Integration

#### GitHub Actions Configuration
```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Setup test database
      run: npm run test:setup

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Run E2E tests
      run: npm run test:e2e
      if: github.event_name == 'pull_request'

    - name: Upload coverage
      uses: codecov/codecov-action@v2
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. Test Reporting

#### Coverage Reporting
```typescript
// scripts/generate-test-report.ts
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

export function generateTestReport() {
  // Run tests with coverage
  execSync('npm run test:coverage', { stdio: 'inherit' });

  // Generate coverage report
  const coverage = require('../coverage/coverage-summary.json');

  const report = {
    timestamp: new Date().toISOString(),
    totalLines: coverage.total.lines.pct,
    totalStatements: coverage.total.statements.pct,
    totalBranches: coverage.total.branches.pct,
    totalFunctions: coverage.total.functions.pct,
    thresholds: {
      lines: 80,
      statements: 80,
      branches: 75,
      functions: 80,
    },
    passed: coverage.total.lines.pct >= 80,
  };

  writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  return report;
}
```

## Test Environment Monitoring

### 1. Test Metrics Collection

#### Test Performance Monitoring
```typescript
// services/test-monitoring.ts
export class TestMonitoring {
  private static metrics: any[] = [];

  static recordMetric(metric: any) {
    this.metrics.push({
      ...metric,
      timestamp: new Date().toISOString(),
    });
  }

  static recordTestDuration(testName: string, duration: number) {
    this.recordMetric({
      type: 'test_duration',
      name: testName,
      duration,
    });
  }

  static recordTestResult(testName: string, passed: boolean) {
    this.recordMetric({
      type: 'test_result',
      name: testName,
      passed,
    });
  }

  static generateReport() {
    return {
      metrics: this.metrics,
      summary: {
        totalTests: this.metrics.length,
        passedTests: this.metrics.filter(m => m.type === 'test_result' && m.passed).length,
        averageDuration: this.metrics
          .filter(m => m.type === 'test_duration')
          .reduce((sum, m) => sum + m.duration, 0) /
          this.metrics.filter(m => m.type === 'test_duration').length,
      },
    };
  }
}
```

This comprehensive testing strategy ensures that the Zanari project maintains high code quality, data security, and reliable performance across all environments while providing developers with the tools and processes needed for efficient testing.