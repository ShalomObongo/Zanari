/**
 * Jest Testing Setup for Zanari2 React Native App
 * Configures mocks, test utilities, and global testing environment
 */

import 'react-native-gesture-handler/jestSetup';

// Mock react-native modules that don't work in Jest environment
const mockJestFn = (): jest.Mock => jest.fn();

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock React Native AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock React Native Keychain for PIN storage
jest.mock('react-native-keychain', () => ({
  SECURITY_LEVEL: {},
  setInternetCredentials: mockJestFn().mockResolvedValue(undefined),
  getInternetCredentials: mockJestFn().mockResolvedValue({ password: 'mock-pin-hash' }),
  resetInternetCredentials: mockJestFn().mockResolvedValue(undefined),
}));

// Mock Expo SecureStore
jest.mock('expo-secure-store', () => ({
  setItemAsync: mockJestFn().mockResolvedValue(undefined),
  getItemAsync: mockJestFn().mockResolvedValue('mock-value'),
  deleteItemAsync: mockJestFn().mockResolvedValue(undefined),
}));

// Mock Expo Camera
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: mockJestFn().mockResolvedValue({ status: 'granted' }),
  },
}));

// Mock Expo Image Picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: mockJestFn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: mockJestFn().mockResolvedValue({
    cancelled: false,
    uri: 'mock-image-uri',
    type: 'image',
  }),
}));

// Mock Expo Document Picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: mockJestFn().mockResolvedValue({
    type: 'success',
    uri: 'mock-document-uri',
    name: 'test-document.pdf',
    size: 1024,
  }),
}));

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: mockJestFn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: mockJestFn().mockResolvedValue('notification-id'),
  addNotificationReceivedListener: mockJestFn().mockReturnValue({ remove: mockJestFn() }),
  addNotificationResponseReceivedListener: mockJestFn().mockReturnValue({ remove: mockJestFn() }),
}));

// Mock Expo Crypto with Node.js crypto fallback
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('node:crypto');
  const CryptoDigestAlgorithm = {
    SHA1: 'SHA-1',
    SHA256: 'SHA-256',
    SHA384: 'SHA-384',
    SHA512: 'SHA-512',
  } as const;

  return {
    CryptoDigestAlgorithm,
    digestStringAsync: jest.fn(async (_algorithm: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data).digest('hex'),
    ),
    getRandomBytesAsync: jest.fn(async (length: number) =>
      Uint8Array.from(nodeCrypto.randomBytes(length)),
    ),
  };
});

// Mock DevMenu native module to avoid TurboModule lookups in tests
jest.mock('react-native/src/private/devsupport/devmenu/specs/NativeDevMenu', () => ({
  __esModule: true,
  default: {
    show: mockJestFn(),
    hide: mockJestFn(),
    addListener: mockJestFn(),
    removeListeners: mockJestFn(),
  },
}));

// Mock Expo Local Authentication (Biometrics)
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: mockJestFn().mockResolvedValue(true),
  isEnrolledAsync: mockJestFn().mockResolvedValue(true),
  authenticateAsync: mockJestFn().mockResolvedValue({ success: true }),
}));

// Mock SettingsManager TurboModule variations used across platforms
jest.mock('react-native/src/private/specs_DEPRECATED/modules/NativeSettingsManager', () => ({
  __esModule: true,
  default: {
    getConstants: mockJestFn().mockReturnValue({}),
    setValues: mockJestFn(),
    addListener: mockJestFn(),
    removeListeners: mockJestFn(),
  },
}));

jest.mock('react-native/Libraries/Settings/NativeSettingsManager', () => ({
  __esModule: true,
  default: {
    getConstants: mockJestFn().mockReturnValue({}),
    setValues: mockJestFn(),
    addListener: mockJestFn(),
    removeListeners: mockJestFn(),
  },
}));

// Mock React Native Vector Icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');

// Mock Paystack WebView
jest.mock('react-native-paystack-webview', () => {
  const MockPaystackWebView = () => null;
  MockPaystackWebView.displayName = 'PaystackWebView';
  return MockPaystackWebView;
});

// Mock Supabase Client
jest.mock('@supabase/supabase-js', () => ({
  createClient: mockJestFn().mockReturnValue({
    auth: {
      signUp: mockJestFn().mockResolvedValue({ data: { user: null }, error: null }),
      signIn: mockJestFn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: mockJestFn().mockResolvedValue({ error: null }),
      onAuthStateChange: mockJestFn().mockReturnValue({
        data: { subscription: { unsubscribe: mockJestFn() } },
      }),
      getUser: mockJestFn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: mockJestFn().mockReturnValue({
      select: mockJestFn().mockResolvedValue({ data: [], error: null }),
      insert: mockJestFn().mockResolvedValue({ data: [], error: null }),
      update: mockJestFn().mockResolvedValue({ data: [], error: null }),
      delete: mockJestFn().mockResolvedValue({ data: [], error: null }),
      eq: mockJestFn().mockResolvedValue({ data: [], error: null }),
    }),
    storage: {
      from: mockJestFn().mockReturnValue({
        upload: mockJestFn().mockResolvedValue({ data: null, error: null }),
        download: mockJestFn().mockResolvedValue({ data: null, error: null }),
        remove: mockJestFn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockJestFn(),
    goBack: mockJestFn(),
    reset: mockJestFn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: mockJestFn(),
}));

// Global test utilities
const originalConsole = console;
global.console = {
  ...console,
  // Suppress console.warn in tests unless explicitly needed
  warn: mockJestFn(),
  error: mockJestFn(),
};

// Mock Alert for React Native
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: mockJestFn(),
  },
  Linking: {
    openURL: mockJestFn().mockResolvedValue(undefined),
  },
}));

// Setup for testing financial calculations (avoid floating point issues)
(global as any).expectFinancialAmount = (received: number, expected: number, tolerance = 1) => {
  const difference = Math.abs(received - expected);
  if (difference > tolerance) {
    throw new Error(
      `Expected financial amount ${received} to be within ${tolerance} cents of ${expected}`
    );
  }
};

// Mock performance.now for testing timeouts and delays
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: mockJestFn().mockReturnValue(Date.now()),
  },
});

// Mock fetch for API testing
global.fetch = mockJestFn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(''),
  status: 200,
  headers: {
    get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
  },
}) as jest.Mock;

// Test data factories for consistent test data
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@zanari.app',
  phone: '+254712345678',
  first_name: 'Test',
  last_name: 'User',
  kyc_status: 'approved' as const,
  status: 'active' as const,
  notification_preferences: {
    push_enabled: true,
    email_enabled: true,
    transaction_alerts: true,
    savings_milestones: true,
  },
  failed_pin_attempts: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockWallet = (type: 'main' | 'savings', overrides = {}) => ({
  id: `test-wallet-${type}`,
  user_id: 'test-user-id',
  wallet_type: type,
  balance: type === 'main' ? 100000 : 25000, // KES 1,000 main, KES 250 savings
  available_balance: type === 'main' ? 100000 : 25000,
  last_transaction_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockTransaction = (overrides = {}) => ({
  id: 'test-transaction-id',
  user_id: 'test-user-id',
  type: 'payment' as const,
  status: 'completed' as const,
  amount: 25000, // KES 250
  category: 'groceries' as const,
  auto_categorized: true,
  retry_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  ...overrides,
});

export const createMockSavingsGoal = (overrides = {}) => ({
  id: 'test-goal-id',
  user_id: 'test-user-id',
  name: 'Emergency Fund',
  target_amount: 500000, // KES 5,000
  current_amount: 125000, // KES 1,250 (25% progress)
  status: 'active' as const,
  lock_in_enabled: false,
  milestones: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockRoundUpRule = (overrides = {}) => ({
  id: 'test-rule-id',
  user_id: 'test-user-id',
  increment_type: '10' as const,
  is_enabled: true,
  total_round_ups_count: 45,
  total_amount_saved: 67500, // KES 675
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Custom matchers for testing
expect.extend({
  toBeValidKESAmount(received: number) {
    const pass = typeof received === 'number' && received >= 0 && Number.isInteger(received);
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid KES amount in cents`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid KES amount in cents (positive integer)`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidKESAmount(): R;
    }
  }
}