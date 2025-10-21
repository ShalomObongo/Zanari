module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/tests/setup.ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.expo/',
    '<rootDir>/node_modules/',
    '<rootDir>/api/' // Backend tests are separate
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@supabase/supabase-js|zustand)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/navigation/**', // UI-heavy navigation components
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Stricter coverage for financial logic
    'src/services/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/utils/**/*.{ts,tsx}': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/globalTeardown.ts'
};