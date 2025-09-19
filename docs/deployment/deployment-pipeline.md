# Zanari Deployment Pipeline Documentation

## Overview

This document outlines the comprehensive deployment pipeline for the Zanari project, covering mobile applications, backend services, and infrastructure deployment across development, staging, and production environments.

## Deployment Strategy

### Environments
- **Development:** Local development with automated testing
- **Staging:** Pre-production environment for testing
- **Production:** Live environment for end users

### Deployment Methodology
- **Mobile App:** App Store and Play Store releases
- **Backend Services:** Continuous deployment to Supabase
- **Infrastructure:** Infrastructure as Code (IaC) with Terraform

## 1. Mobile Application Deployment

### 1.1 iOS Deployment

#### Build Configuration
```yaml
# ios/Zanari.xcodeproj/project.pbxproj build settings
BUILD_TYPE = Release
CODE_SIGN_IDENTITY = iPhone Distribution
PROVISIONING_PROFILE_SPECIFIER = Zanari Distribution
PRODUCT_BUNDLE_IDENTIFIER = com.zanari.mobile
DEVELOPMENT_TEAM = YOUR_TEAM_ID
```

#### Fastfile for iOS
```ruby
# fastlane/Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and deploy iOS app to TestFlight"
  lane :beta do
    # Ensure clean build directory
    clean_build_artifacts

    # Install dependencies
    cocoapods(
      clean_install: true,
      podfile: "./ios/Podfile"
    )

    # Increment build number
    increment_build_number(
      build_number: latest_testflight_build_number + 1
    )

    # Build app
    build_app(
      workspace: "ios/Zanari.xcworkspace",
      scheme: "Zanari",
      configuration: "Release",
      export_method: "app-store",
      output_directory: "./build"
    )

    # Upload to TestFlight
    upload_to_testflight(
      skip_waiting_for_build_processing: true,
      distribute_external: false,
      notify_external_testers: false
    )

    # Create Slack notification
    slack(
      message: "Successfully deployed iOS build #{lane_context[SharedValues::BUILD_NUMBER]} to TestFlight",
      success: true
    )
  end

  desc "Deploy iOS app to App Store"
  lane :release do
    # Run beta lane first
    beta

    # Upload to App Store
    upload_to_app_store(
      force: true,
      submit_for_review: true,
      automatic_release: true,
      precheck_include_in_app_purchases: false
    )

    # Create release notes
    set_changelog(
      changelog: File.read("../CHANGELOG.md")
    )

    # Create Slack notification
    slack(
      message: "Successfully submitted iOS build #{lane_context[SharedValues::BUILD_NUMBER]} to App Store",
      success: true
    )
  end
end
```

### 1.2 Android Deployment

#### Build Configuration
```gradle
// android/app/build.gradle
android {
  compileSdkVersion 34
  buildToolsVersion "34.0.0"

  defaultConfig {
    applicationId "com.zanari.mobile"
    minSdkVersion 21
    targetSdkVersion 34
    versionCode 1
    versionName "1.0.0"
  }

  signingConfigs {
    release {
      storeFile file('../app.keystore')
      storePassword System.getenv('KEYSTORE_PASSWORD')
      keyAlias System.getenv('KEY_ALIAS')
      keyPassword System.getenv('KEY_PASSWORD')
    }
  }

  buildTypes {
    release {
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
      signingConfig signingConfigs.release
    }
  }
}
```

#### Fastfile for Android
```ruby
# fastlane/Fastfile (continued)
platform :android do
  desc "Build and deploy Android app to internal testing"
  lane :beta do
    # Ensure clean build directory
    clean_build_artifacts

    # Increment version code
    increment_version_code(
      gradle_file_path: "android/app/build.gradle"
    )

    # Build app
    build_android_app(
      task: 'assemble',
      build_type: 'Release',
      print_output: true,
      properties: {
        "android.injected.signing.store.file" => "../app.keystore",
        "android.injected.signing.store.password" => ENV['KEYSTORE_PASSWORD'],
        "android.injected.signing.key.alias" => ENV['KEY_ALIAS'],
        "android.injected.signing.key.password" => ENV['KEY_PASSWORD'],
      }
    )

    # Upload to Google Play Console
    upload_to_play_store(
      track: 'internal',
      release_status: 'draft',
      aab: '../build/app/outputs/bundle/release/app-release.aab'
    )

    # Create Slack notification
    slack(
      message: "Successfully deployed Android build #{lane_context[SharedValues::VERSION_CODE]} to internal testing",
      success: true
    )
  end

  desc "Deploy Android app to production"
  lane :release do
    # Run beta lane first
    beta

    # Promote to production
    upload_to_play_store(
      track: 'production',
      release_status: 'draft',
      aab: '../build/app/outputs/bundle/release/app-release.aab',
      rollout: '0.1' # 10% rollout initially
    )

    # Create Slack notification
    slack(
      message: "Successfully deployed Android build #{lane_context[SharedValues::VERSION_CODE]} to production (10% rollout)",
      success: true
    )
  end
end
```

## 2. Backend Deployment

### 2.1 Supabase Deployment

#### Database Migrations
```bash
#!/bin/bash
# scripts/deploy-supabase.sh

set -e

echo "🚀 Deploying to Supabase..."

# Set environment
if [ "$ENVIRONMENT" = "production" ]; then
  SUPABASE_PROJECT_ID="your-production-project"
  SUPABASE_ACCESS_TOKEN=$PROD_SUPABASE_TOKEN
else
  SUPABASE_PROJECT_ID="your-staging-project"
  SUPABASE_ACCESS_TOKEN=$STAGING_SUPABASE_TOKEN
fi

# Login to Supabase CLI
npx supabase login --token $SUPABASE_ACCESS_TOKEN

# Link to project
npx supabase link --project-ref $SUPABASE_PROJECT_ID

# Push database changes
npx supabase db push

# Deploy edge functions
npx supabase functions deploy

# Generate types
npx supabase gen types typescript --local > types/database.ts

echo "✅ Supabase deployment completed!"
```

#### Edge Functions Deployment
```typescript
# supabase/functions/roundup-webhook/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()

    // Verify M-PESA webhook signature
    const signature = req.headers.get('x-mpesa-signature')
    if (!verifyMpesaSignature(JSON.stringify(record), signature)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Process round-up transaction
    const result = await processRoundupTransaction(record)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function verifyMpesaSignature(payload: string, signature: string): Promise<boolean> {
  // Implement signature verification
  return true
}

async function processRoundupTransaction(transaction: any): Promise<any> {
  // Implement round-up logic
  return { success: true }
}
```

### 2.2 API Gateway Deployment

#### API Gateway Configuration
```typescript
# api/gateway.ts
import { createRouter } from 'https://deno.land/x/oak@v12.6.1/mod.ts'
import { applyCors } from './middleware/cors.ts'
import { authMiddleware } from './middleware/auth.ts'
import { rateLimiter } from './middleware/rateLimiter.ts'

const router = new Router()

// Apply global middleware
router.use(applyCors)
router.use(rateLimiter)

// Health check endpoint
router.get('/health', (ctx) => {
  ctx.response.body = { status: 'healthy', timestamp: new Date().toISOString() }
})

// Protected routes
router.use('/api/v1', authMiddleware)

// Import route modules
router.use('/api/v1/users', await import('./routes/users.ts'))
router.use('/api/v1/transactions', await import('./routes/transactions.ts'))
router.use('/api/v1/goals', await import('./routes/goals.ts'))
router.use('/api/v1/mpesa', await import('./routes/mpesa.ts'))

export default router
```

## 3. Infrastructure as Code (IaC)

### 3.1 Terraform Configuration

#### Main Configuration
```hcl
# main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "supabase" {
  access_token = var.supabase_access_token
}

# Variable definitions
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production"
  }
}

variable "supabase_access_token" {
  description = "Supabase access token"
  type        = string
  sensitive   = true
}

# Outputs
output "supabase_project_url" {
  description = "Supabase project URL"
  value       = supabase_project.main.url
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}
```

#### Supabase Project Configuration
```hcl
# supabase.tf
resource "supabase_project" "main" {
  name        = "zanari-${var.environment}"
  organization_id = var.organization_id
  region      = var.supabase_region
  database_password = var.database_password

  # Postgres configuration
  db_version = "15.1.1.122"
  db_size_gb = 1
  pitr_days  = var.environment == "production" ? 7 : 0

  # Security
  ip_allow = [
    "0.0.0.0/0"
  ]

  # Realtime
  realtime_enabled = true

  # Storage
  storage_size_gb = 1
}

resource "supabase_project_auth" "main" {
  project_id = supabase_project.main.id
  site_url   = "https://zanari-${var.environment}.com"
  redirect_urls = [
    "zanari://auth/callback",
    "https://zanari-${var.environment}.com/auth/callback"
  ]
}

resource "supabase_project_storage" "main" {
  project_id = supabase_project.main.id
  public     = false
  file_size_limit = 52428800 # 50MB
  allowed_mime_types = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf"
  ]
}
```

#### AWS Infrastructure
```hcl
# aws.tf
resource "aws_s3_bucket" "static_assets" {
  bucket = "zanari-${var.environment}-static-assets"
  acl    = "private"

  versioning {
    enabled = true
  }

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }

  tags = {
    Environment = var.environment
    Project     = "Zanari"
  }
}

resource "aws_cloudfront_distribution" "static_assets" {
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-zanari-${var.environment}-static-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.iam_arn
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Zanari static assets CDN"
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-zanari-${var.environment}-static-assets"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["KE"] # Kenya only
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment = var.environment
    Project     = "Zanari"
  }
}

resource "aws_apigatewayv2_api" "main" {
  name          = "zanari-${var.environment}-api"
  protocol_type = "HTTP"
  description   = "Zanari API Gateway"

  cors_configuration {
    allow_headers = ["content-type", "authorization", "x-api-key"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true
}
```

## 4. CI/CD Pipeline

### 4.1 GitHub Actions Configuration

#### Main Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  PYTHON_VERSION: '3.9'

jobs:
  test:
    runs-on: ubuntu-latest
    outputs:
      test-result: ${{ steps.test.outputs.result }}

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      id: test
      run: npm run test:ci

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}

  build-mobile:
    runs-on: macos-latest
    needs: test
    if: needs.test.outputs.test-result == 'success'

    strategy:
      matrix:
        platform: [ios, android]

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Setup Ruby (for iOS)
      if: matrix.platform == 'ios'
      uses: ruby/setup-ruby@v1
      with:
        ruby-version: '3.0'

    - name: Install Fastlane
      run: |
        gem install fastlane
        bundle install

    - name: Build iOS
      if: matrix.platform == 'ios'
      run: |
        cd ios
        pod install
        cd ..
        fastlane ios beta
      env:
        MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
        FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: ${{ secrets.FASTLANE_PASSWORD }}
        KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}

    - name: Build Android
      if: matrix.platform == 'android'
      run: fastlane android beta
      env:
        KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
        KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        KEY_ALIAS: ${{ secrets.KEY_ALIAS }}

  deploy-backend:
    runs-on: ubuntu-latest
    needs: test
    if: needs.test.outputs.test-result == 'success'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Deploy to Staging
      if: github.ref == 'refs/heads/develop'
      run: |
        npm run deploy:staging
      env:
        STAGING_SUPABASE_TOKEN: ${{ secrets.STAGING_SUPABASE_TOKEN }}
        STAGING_DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

    - name: Deploy to Production
      if: github.ref == 'refs/heads/main'
      run: |
        npm run deploy:production
      env:
        PROD_SUPABASE_TOKEN: ${{ secrets.PROD_SUPABASE_TOKEN }}
        PROD_DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}

  deploy-infrastructure:
    runs-on: ubuntu-latest
    needs: test
    if: needs.test.outputs.test-result == 'success'

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v2
      with:
        terraform_version: '1.5.0'

    - name: Terraform Init
      run: terraform init

    - name: Terraform Plan
      run: terraform plan -out=tfplan

    - name: Terraform Apply
      if: github.ref == 'refs/heads/main'
      run: terraform apply -auto-approve tfplan
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### 4.2 Environment Configuration

#### Environment Files
```bash
# .env.staging
# Supabase Configuration
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-key
SUPABASE_SERVICE_KEY=your-staging-service-key

# M-PESA Configuration
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=your-staging-consumer-key
MPESA_CONSUMER_SECRET=your-staging-consumer-secret

# AWS Configuration
AWS_ACCESS_KEY_ID=your-staging-aws-key
AWS_SECRET_ACCESS_KEY=your-staging-aws-secret
AWS_REGION=eu-west-1

# Feature Flags
FEATURE_ROLLUP_ENABLED=true
FEATURE_GOALS_ENABLED=true
FEATURE_ANALYTICS_ENABLED=true
```

## 5. Monitoring and Observability

### 5.1 Logging Configuration

#### Structured Logging
```typescript
# services/logger.ts
import pino from 'pino'
import pretty from 'pino-pretty'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'zanari',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
}, pretty())

export default logger

# Usage example
logger.info('User registered successfully', {
  userId: '123',
  email: 'user@example.com',
  action: 'user_registration',
})
```

### 5.2 Monitoring Setup

#### Application Metrics
```typescript
# services/metrics.ts
import client from 'prom-client'

const register = new client.Registry()

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
})

const activeUsers = new client.Gauge({
  name: 'active_users',
  help: 'Number of active users',
})

const transactionAmount = new client.Histogram({
  name: 'transaction_amount_kes',
  help: 'Transaction amounts in KES',
  labelNames: ['type'],
  buckets: [10, 50, 100, 500, 1000, 5000, 10000],
})

register.registerMetric(httpRequestDuration)
register.registerMetric(activeUsers)
register.registerMetric(transactionAmount)

export { register, httpRequestDuration, activeUsers, transactionAmount }
```

### 5.3 Alert Configuration

#### Prometheus Alerts
```yaml
# alerts/prometheus-alerts.yml
groups:
  - name: zanari
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: DatabaseConnectionsHigh
        expr: pg_stat_database_numbackends / pg_settings_max_connections * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database connections at {{ $value }}% of maximum"
```

## 6. Security and Compliance

### 6.1 Security Scans

#### GitHub Actions Security Scan
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      with:
        args: --severity-threshold=high
        command: test
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

    - name: Run npm audit
      run: npm audit --audit-level=moderate

    - name: Check for secrets
      uses: max/secret-scan@v1.0.0

    - name: Run OWASP dependency check
      uses: dependency-check/dependency-check-action@v3
```

### 6.2 Compliance Checks

#### Data Protection Compliance
```typescript
# services/compliance.ts
export class ComplianceService {
  static async checkDataPrivacy(): Promise<boolean> {
    // Check if user data is properly anonymized
    // Verify encryption is enabled
    // Check retention policies
    return true
  }

  static async checkFinancialCompliance(): Promise<boolean> {
    // Verify transaction logging
    // Check audit trails
    // Validate data localization
    return true
  }

  static generateComplianceReport() {
    return {
      dataPrivacy: this.checkDataPrivacy(),
      financialCompliance: this.checkFinancialCompliance(),
      lastAudit: new Date().toISOString(),
      nextAudit: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    }
  }
}
```

## 7. Rollback and Recovery

### 7.1 Rollback Procedures

#### Database Rollback
```bash
#!/bin/bash
# scripts/rollback-database.sh

set -e

ENVIRONMENT=${1:-staging}
TIMESTAMP=${2:-$(date +%Y%m%d%H%M%S)}

echo "🔄 Rolling back database for $ENVIRONMENT..."

# Set environment variables
if [ "$ENVIRONMENT" = "production" ]; then
  SUPABASE_PROJECT_ID="your-production-project"
  SUPABASE_ACCESS_TOKEN=$PROD_SUPABASE_TOKEN
else
  SUPABASE_PROJECT_ID="your-staging-project"
  SUPABASE_ACCESS_TOKEN=$STAGING_SUPABASE_TOKEN
fi

# Create backup before rollback
echo "📦 Creating backup..."
npx supabase db dump --local > "backups/backup-$TIMESTAMP.sql"

# Apply rollback migration
echo "⬇️  Applying rollback..."
npx supabase db push --use-migrations

echo "✅ Database rollback completed!"
```

#### App Rollback
```bash
#!/bin/bash
# scripts/rollback-app.sh

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-$(git describe --tags --abbrev=0)}

echo "🔄 Rolling back app to version $VERSION for $ENVIRONMENT..."

# Rollback iOS app
if [ "$ENVIRONMENT" = "production" ]; then
  fastlane ios rollback_version:$VERSION
fi

# Rollback Android app
if [ "$ENVIRONMENT" = "production" ]; then
  fastlane android rollback_version:$VERSION
fi

# Rollback backend
npx supabase functions deploy --project-ref $SUPABASE_PROJECT_ID

echo "✅ App rollback completed!"
```

## 8. Deployment Best Practices

### 8.1 Blue-Green Deployment

#### Deployment Strategy
```typescript
# services/deployment-manager.ts
export class DeploymentManager {
  static async deployWithBlueGreen(deploymentConfig: DeploymentConfig): Promise<DeploymentResult> {
    const { environment, version, rollbackVersion } = deploymentConfig

    try {
      // Deploy to green environment
      await this.deployToGreen(environment, version)

      // Run smoke tests
      await this.runSmokeTests(environment)

      // Switch traffic to green
      await this.switchTraffic(environment, 'green')

      // Monitor health
      await this.monitorHealth(environment)

      // Cleanup blue environment
      await this.cleanupBlue(environment)

      return { success: true, version }
    } catch (error) {
      // Rollback on failure
      await this.rollback(environment, rollbackVersion)
      return { success: false, error: error.message }
    }
  }

  private static async deployToGreen(environment: string, version: string): Promise<void> {
    // Implementation for green deployment
  }

  private static async runSmokeTests(environment: string): Promise<void> {
    // Implementation for smoke tests
  }

  private static async switchTraffic(environment: string, target: string): Promise<void> {
    // Implementation for traffic switching
  }

  private static async monitorHealth(environment: string): Promise<void> {
    // Implementation for health monitoring
  }

  private static async cleanupBlue(environment: string): Promise<void> {
    // Implementation for cleanup
  }
}
```

### 8.2 Canary Releases

#### Canary Deployment Strategy
```typescript
# services/canary-deployment.ts
export class CanaryDeployment {
  static async deployWithCanary(deploymentConfig: DeploymentConfig): Promise<DeploymentResult> {
    const { environment, version, rolloutPercentage } = deploymentConfig

    try {
      // Deploy to canary instances
      await this.deployToCanary(environment, version)

      // Monitor metrics
      const metrics = await this.monitorCanaryMetrics(environment)

      // Evaluate deployment health
      const health = this.evaluateCanaryHealth(metrics)

      if (health === 'healthy') {
        // Gradual rollout
        await this.gradualRollout(environment, version, rolloutPercentage)
        return { success: true, version }
      } else if (health === 'degraded') {
        // Rollback canary
        await this.rollbackCanary(environment, version)
        return { success: false, error: 'Canary deployment failed health checks' }
      } else {
        // Continue monitoring
        return { success: false, error: 'Canary health undetermined' }
      }
    } catch (error) {
      await this.rollbackCanary(environment, version)
      return { success: false, error: error.message }
    }
  }
}
```

This comprehensive deployment pipeline ensures that the Zanari application can be deployed reliably and securely across all environments while maintaining high availability and providing robust rollback capabilities.