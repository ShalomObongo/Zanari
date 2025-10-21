/**
 * Global setup for Jest testing environment
 * Runs once before all tests
 */

export default async function globalSetup() {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY = 'pk_test_test_key';
  
  // Set timezone for consistent date/time testing
  process.env.TZ = 'UTC';
  
  // Suppress console output during tests unless explicitly enabled
  if (!process.env.VERBOSE_TESTS) {
    const noop = () => {};
    global.console = {
      ...console,
      log: noop,
      warn: noop,
      error: noop,
      info: noop,
    };
  }
  
  console.log('🧪 Test environment initialized');
}