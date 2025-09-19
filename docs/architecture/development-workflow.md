# Development Workflow

## Local Development Setup

### Prerequisites
```bash
# Required tools
node --version  # >= 18.0.0
npm --version   # >= 8.0.0

# Install Nx CLI globally
npm install -g nx@latest

# Install Supabase CLI
npm install -g supabase
```

### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/zanari.git
cd zanari

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Link local packages
nx run-many --target=build --all

# Start Supabase local development
supabase start

# Run database migrations
supabase db push

# Install app dependencies (iOS)
cd apps/mobile && npm install

# Install app dependencies (Android)
cd apps/mobile && npm install

# Install iOS pods
cd apps/mobile/ios && pod install
```

### Development Commands
```bash
# Start all services
nx run-many --target=serve --all

# Start mobile app (iOS)
nx run mobile:serve --platform=ios

# Start mobile app (Android)
nx run mobile:serve --platform=android

# Start backend services
supabase functions serve

# Run tests
nx test

# Run linting
nx lint

# Build for production
nx run-many --target=build --all
```

## Environment Configuration

### Required Environment Variables

```bash
# Frontend (.env.local)
EXPO_PUBLIC_API_URL=https://api.zanari.com/v1
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend (.env)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MPESA_CONSUMER_KEY=your-mpesa-consumer-key
MPESA_CONSUMER_SECRET=your-mpesa-consumer-secret
MPESA_SHORT_CODE=your-short-code
MPESA_PASSKEY=your-passkey
MPESA_WEBHOOK_SECRET=your-webhook-secret
SMS_GATEWAY_API_KEY=your-sms-api-key
SMS_GATEWAY_USERNAME=your-sms-username
SENTRY_DSN=your-sentry-dsn
```
