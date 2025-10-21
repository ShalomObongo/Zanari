module.exports = {
  extends: [
    'expo',
    '@react-native-community',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-native',
    'react-hooks'
  ],
  rules: {
    // TypeScript strict rules for financial app
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/restrict-template-expressions': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    
    // React Native specific rules
    'react-native/no-unused-styles': 'error',
    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'warn',
    'react-native/no-raw-text': 'off', // Sometimes needed for formatted text
    
    // React hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',
    
    // General code quality
    'no-console': 'warn', // Allow console in development, warn for production builds
    'no-debugger': 'error',
    'no-alert': 'error', // Use proper error handling instead
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    
    // Financial app security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Performance
    'react/jsx-key': 'error',
    'react/no-array-index-key': 'warn',
    
    // Accessibility
    'react/jsx-props-no-spreading': 'off', // Allow props spreading for component composition
    
    // Import organization
    'sort-imports': ['error', {
      'ignoreCase': true,
      'ignoreDeclarationSort': true, // Let import/order handle this
      'ignoreMemberSort': false,
      'memberSyntaxSortOrder': ['none', 'all', 'multiple', 'single']
    }]
  },
  env: {
    'react-native/react-native': true,
    es2021: true,
    node: true,
    jest: true
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true
      },
      rules: {
        // Relax some rules for test files
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        'no-console': 'off'
      }
    },
    {
      files: ['**/*.js'],
      rules: {
        // Relax TypeScript rules for JS files
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'build/',
    'coverage/',
    '*.d.ts'
  ]
};