const { configs } = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'api/**', // Backend code has separate linting
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: parser,
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      'react-hooks': require('eslint-plugin-react-hooks'),
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'error',
      
      // General JavaScript rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      
      // React Native specific
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-uses-react': 'off', // React 17+
      'react/react-in-jsx-scope': 'off', // React 17+
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    // Additional config for test files
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      'no-console': 'off', // Allow console in tests
    },
  },
];