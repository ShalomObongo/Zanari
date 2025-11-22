module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/api/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.(js|ts)$': 'babel-jest'
  },
  // Don't ignore api folder
  testPathIgnorePatterns: ['/node_modules/'],
};
