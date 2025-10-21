/**
 * Global teardown for Jest testing environment
 * Runs once after all tests complete
 */

export default async function globalTeardown() {
  // Clean up any test resources
  console.log('🧹 Test environment cleanup complete');
}