#!/usr/bin/env node

/**
 * Zanari Fintech Application - Environment Validation Script
 * Critical security: Validates environment configuration and detects secrets
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Colors for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Secret patterns to detect
const SECRET_PATTERNS = [
    {
        name: 'Supabase Service Role Key',
        pattern: /supabase_service_role_key\s*=\s*[a-zA-Z0-9_-]{40,}/i,
        critical: true
    },
    {
        name: 'Supabase Anonymous Key',
        pattern: /supabase_anon_key\s*=\s*[a-zA-Z0-9_-]{40,}/i,
        critical: true
    },
    {
        name: 'Supabase URL',
        pattern: /supabase_url\s*=\s*https?:\/\/[^\s]+/i,
        critical: false
    },
    {
        name: 'Stripe Secret Key',
        pattern: /sk_[a-zA-Z0-9_-]{40,}/i,
        critical: true
    },
    {
        name: 'Stripe Publishable Key',
        pattern: /pk_(test|live)_[a-zA-Z0-9_-]{40,}/i,
        critical: false
    },
    {
        name: 'Google API Key',
        pattern: /AIza[0-9A-Za-z_-]{35}/i,
        critical: true
    },
    {
        name: 'GitHub Token',
        pattern: /gh[opsu]_[a-zA-Z0-9_-]{36,}/i,
        critical: true
    },
    {
        name: 'AWS Access Key',
        pattern: /AKIA[0-9A-Z]{16}/i,
        critical: true
    }
];

// Required environment variables for development
const REQUIRED_ENV_VARS = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY'
];

// Optional but recommended environment variables
const RECOMMENDED_ENV_VARS = [
    'NODE_ENV',
    'SUPABASE_URL'
];

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function checkFileForSecrets(filePath) {
    if (!fs.existsSync(filePath)) {
        return { secrets: [], criticalSecrets: 0 };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const secrets = [];
    let criticalSecrets = 0;

    SECRET_PATTERNS.forEach(({ name, pattern, critical }) => {
        const matches = content.match(pattern);
        if (matches) {
            secrets.push({ name, matches, critical });
            if (critical) criticalSecrets++;
        }
    });

    return { secrets, criticalSecrets };
}

function validateEnvironmentFile(filePath) {
    if (!fs.existsSync(filePath)) {
        logWarning(`Environment file not found: ${filePath}`);
        return false;
    }

    logInfo(`Validating environment file: ${filePath}`);

    const { secrets, criticalSecrets } = checkFileForSecrets(filePath);

    if (secrets.length > 0) {
        logError(`Secrets detected in ${filePath}:`);
        secrets.forEach(({ name, matches, critical }) => {
            const prefix = critical ? '🚨' : '⚠️';
            log(`   ${prefix} ${name}: ${matches.length} occurrence(s)`, critical ? 'red' : 'yellow');
        });

        if (criticalSecrets > 0) {
            logError(`Critical secrets found! This file should not be committed.`);
            return false;
        }
    } else {
        logSuccess(`No secrets detected in ${filePath}`);
    }

    return true;
}

function checkRequiredEnvironment() {
    logInfo('Checking required environment variables...');

    const missing = [];
    const present = [];

    REQUIRED_ENV_VARS.forEach(envVar => {
        if (process.env[envVar]) {
            present.push(envVar);
        } else {
            missing.push(envVar);
        }
    });

    if (present.length > 0) {
        logSuccess(`Present: ${present.join(', ')}`);
    }

    if (missing.length > 0) {
        logError(`Missing required: ${missing.join(', ')}`);
        return false;
    }

    return true;
}

function checkRecommendedEnvironment() {
    logInfo('Checking recommended environment variables...');

    const missing = [];

    RECOMMENDED_ENV_VARS.forEach(envVar => {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    });

    if (missing.length > 0) {
        logWarning(`Missing recommended: ${missing.join(', ')}`);
    } else {
        logSuccess('All recommended variables present');
    }
}

function checkGitignore() {
    const gitignorePath = '.gitignore';

    if (!fs.existsSync(gitignorePath)) {
        logError('.gitignore file not found!');
        return false;
    }

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const requiredIgnores = [
        '.env',
        '.env.local',
        'supabase/.env',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY'
    ];

    const missingIgnores = requiredIgnores.filter(pattern =>
        !gitignore.includes(pattern)
    );

    if (missingIgnores.length > 0) {
        logError(`Missing critical .gitignore patterns: ${missingIgnores.join(', ')}`);
        return false;
    }

    logSuccess('.gitignore properly configured for security');
    return true;
}

function generateSecureEnvTemplate() {
    const template = `# Zanari Fintech Application - Environment Template
# Copy this file to .env.local and fill in your values
# NEVER commit files with actual secrets!

# Supabase Configuration (REQUIRED)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Development Environment
NODE_ENV=development

# Optional Configuration
# SUPABASE_URL=https://your-project.supabase.co

# Analytics (Optional)
# SENTRY_DSN=your-sentry-dsn

# Feature Flags
# ENABLE_DEBUG_MODE=true
# ENABLE_ANALYTICS=false

# IMPORTANT: This file should be in .gitignore
# Do not include actual secret values in version control!`;

    const templatePath = '.env.template';
    fs.writeFileSync(templatePath, template);
    logSuccess(`Environment template created: ${templatePath}`);
}

function main() {
    log(`${colors.bold}🔐 Zanari Fintech Application - Environment Validation${colors.reset}`);
    log('========================================\n');

    let overallSuccess = true;

    // Check .gitignore configuration
    if (!checkGitignore()) {
        overallSuccess = false;
    }

    // Validate environment files
    const envFiles = ['.env', '.env.local', '.env.development', 'supabase/.env'];
    let envFileValid = false;

    envFiles.forEach(file => {
        if (fs.existsSync(file)) {
            if (validateEnvironmentFile(file)) {
                envFileValid = true;
            } else {
                overallSuccess = false;
            }
        }
    });

    if (!envFileValid) {
        logWarning('No valid environment files found');
        generateSecureEnvTemplate();
    }

    // Check environment variables
    console.log();
    if (!checkRequiredEnvironment()) {
        overallSuccess = false;
    }

    checkRecommendedEnvironment();

    // Summary
    console.log();
    if (overallSuccess) {
        logSuccess('🎉 Environment validation passed!');
        logInfo('Your environment is configured securely for development.');
    } else {
        logError('❌ Environment validation failed!');
        logError('Critical security issues detected. Please fix before continuing.');
        process.exit(1);
    }
}

// Run validation
if (require.main === module) {
    main();
}

module.exports = {
    validateEnvironmentFile,
    checkGitignore,
    checkRequiredEnvironment,
    SECRET_PATTERNS
};