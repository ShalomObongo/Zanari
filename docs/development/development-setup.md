# Zanari Development Environment Setup Guide

## Overview

This guide provides step-by-step instructions for setting up a local development environment for the Zanari project. Follow these instructions to get your development machine ready for contributing to the project.

## Prerequisites

### System Requirements
- **Operating System:** macOS, Linux, or Windows (WSL2 recommended)
- **Node.js:** Version 18.x or later
- **npm:** Version 8.x or later (comes with Node.js)
- **Git:** Version 2.x or later
- **Docker:** Optional, for database services
- **IDE:** VS Code with recommended extensions

### Account Requirements
- GitHub account with repository access
- Supabase account (free tier sufficient for development)
- Safaricom Developer Portal account (for M-PESA sandbox access)

## Step 1: Install Development Tools

### 1.1 Node.js and npm
```bash
# Install Node.js using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 18.x
nvm install 18
nvm use 18

# Verify installation
node --version
npm --version
```

### 1.2 Git
```bash
# Install Git (Ubuntu/Debian)
sudo apt update
sudo apt install git

# Install Git (macOS with Homebrew)
brew install git

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 1.3 VS Code Extensions
Install these recommended extensions:
- **ESLint:** `dbaeumer.vscode-eslint`
- **Prettier:** `esbenp.prettier-vscode`
- **TypeScript:** `ms-vscode.typescript-language-features`
- **GraphQL:** `graphql.vscode-graphql`
- **Docker:** `ms-azuretools.vscode-docker`
- **GitLens:** `eamodio.gitlens`

## Step 2: Clone and Setup Repository

### 2.1 Clone Repository
```bash
# Clone the repository
git clone https://github.com/ShalomObongo/zanari.git
cd zanari

# Install dependencies
npm install
```

### 2.2 Install Nx CLI
```bash
# Install Nx CLI globally
npm install -g nx

# Verify installation
nx --version
```

### 2.3 Configure Environment Variables
Create environment files:

```bash
# Copy environment templates
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp supabase/.env.example supabase/.env
```

Edit the `.env` files with your local configuration:

```bash
# .env
# Supabase Configuration
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Development Environment
NODE_ENV=development
PORT=3000

# M-PESA Sandbox Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your-sandbox-consumer-key
MPESA_CONSUMER_SECRET=your-sandbox-consumer-secret
MPESA_PASSKEY=your-sandbox-passkey
MPESA_SHORTCODE=your-sandbox-shortcode
```

## Step 3: Database Setup

### 3.1 Supabase Local Development
```bash
# Navigate to supabase directory
cd supabase

# Initialize Supabase project
npx supabase init

# Start local Supabase stack
npx supabase start

# This will start:
# - PostgreSQL database on port 54322
# - Supabase Studio on port 54323
# - PostgREST on port 54321
# - Auth on port 54324
```

### 3.2 Database Migrations
```bash
# Run database migrations
npx supabase db push

# Generate TypeScript types
npx supabase gen types typescript --local > types/database.ts
```

### 3.3 Seed Data (Optional)
```bash
# Run seed script
npx ts-node scripts/seed-database.ts
```

## Step 4: Mobile App Development

### 4.1 React Native Setup
```bash
# Navigate to mobile app directory
cd apps/mobile

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..

# Install Android dependencies
cd android && ./gradlew clean && cd ..
```

### 4.2 Development Server
```bash
# Start Metro bundler
npm run start

# Start iOS simulator
npm run ios

# Start Android emulator
npm run android
```

### 4.3 Physical Device Setup
For iOS:
```bash
# Enable developer mode on your iPhone
# Connect via USB and trust the computer
npm run ios --device
```

For Android:
```bash
# Enable USB debugging on your Android device
# Connect via USB
npm run android
```

## Step 5: API and Backend Services

### 5.1 Supabase Edge Functions
```bash
# Navigate to supabase/functions
cd supabase/functions

# Deploy edge functions locally
npx supabase functions serve

# This will serve edge functions on:
# http://localhost:54321/functions/v1/
```

### 5.2 Local API Development
```bash
# Start development server for API
npm run dev:api

# API will be available at:
# http://localhost:3001/api
```

## Step 6: Testing Setup

### 6.1 Unit Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### 6.2 Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### 6.3 Test Database Setup
```bash
# Create test database
npx supabase db seed --local

# Run tests with test database
npm run test:local
```

## Step 7: Development Tools and Utilities

### 7.1 Code Quality Tools
```bash
# Run ESLint
npm run lint

# Run Prettier
npm run format

# Run type checking
npm run type-check

# Run all quality checks
npm run quality
```

### 7.2 Database Management
```bash
# View database logs
npx supabase logs db

# Reset local database
npx supabase db reset

# Generate database documentation
npx supabase db docs
```

### 7.3 API Documentation
```bash
# Generate OpenAPI documentation
npm run docs:api

# View API documentation
npm run docs:serve
```

## Step 8: Common Development Tasks

### 8.1 Adding New Dependencies
```bash
# Add to root package.json
npm install package-name

# Add to specific app
npm install package-name --filter=mobile

# Add development dependency
npm install package-name --save-dev
```

### 8.2 Creating New Components
```bash
# Generate new React Native component
nx generate @nx/react-native:component my-component --project=mobile

# Generate new shared component
nx generate @nx/react:component my-component --project=ui
```

### 8.3 Database Schema Changes
```bash
# Create new migration
npx supabase migration new add-users-table

# Edit migration file
# Then apply changes
npx supabase db push
```

### 8.4 Environment-Specific Configuration
```bash
# Create staging environment
cp .env .env.staging

# Create production environment
cp .env .env.production
```

## Step 9: Troubleshooting

### 9.1 Common Issues

**Node.js Version Issues:**
```bash
# Switch to correct Node.js version
nvm use 18

# If 18.x not installed
nvm install 18
```

**Supabase Connection Issues:**
```bash
# Restart Supabase stack
npx supabase stop
npx supabase start

# Check Supabase status
npx supabase status
```

**React Native Build Issues:**
```bash
# Clear metro bundler cache
npm start -- --reset-cache

# Clean build folders
cd android && ./gradlew clean
cd ../ios && xcodebuild clean
```

**Database Migration Issues:**
```bash
# Reset database
npx supabase db reset

# Check migration status
npx supabase migration list
```

### 9.2 Performance Optimization

**Metro Bundler:**
```bash
# Enable metro bundler caching
npm start -- --max-workers 4

# Use Hermes for improved performance
# Add to metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');
const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve('react-native-babel-transformer');
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
```

**Development Server:**
```bash
# Use PM2 for process management
npm install -g pm2
pm2 start npm -- run dev:api
```

## Step 10: Productivity Tips

### 10.1 VS Code Configuration
Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "typescriptreact",
    "javascriptreact"
  ],
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### 10.2 Git Hooks
Install husky for git hooks:
```bash
npm install husky lint-staged --save-dev
npx husky install
npx husky add .husky/pre-commit "npm run quality"
```

### 10.3 Development Scripts
Add useful scripts to `package.json`:
```json
{
  "scripts": {
    "dev:all": "concurrently \"npm run dev:api\" \"npm run start\"",
    "setup": "npm install && npx supabase start && npm run db:migrate",
    "reset": "npx supabase db reset && npm run db:seed",
    "clean": "rm -rf node_modules dist build && npm install",
    "ship": "npm run quality && npm run build && npm run test"
  }
}
```

## Support

For development support:
- Check the project's GitHub issues
- Review Supabase documentation
- Consult React Native documentation
- Join the team's development channel (Slack/Teams)

Remember to commit frequently and keep your development environment updated regularly.