#!/usr/bin/env tsx

import { spawn } from 'child_process';
import { networkInterfaces } from 'os';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Gets the local network IP address of the machine
 * Prioritizes IPv4 addresses on non-internal interfaces
 */
function getLocalNetworkIP(): string {
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;

    for (const net of interfaces) {
      // Skip internal (loopback) addresses and IPv6
      const isIPv4 = net.family === 'IPv4';
      const isNotInternal = !net.internal;

      if (isIPv4 && isNotInternal) {
        return net.address;
      }
    }
  }

  // Fallback to localhost if no network IP found
  console.warn('⚠️  Could not detect local network IP, falling back to localhost');
  return '127.0.0.1';
}

/**
 * Updates the EXPO_PUBLIC_API_URL in the .env file
 */
function updateEnvFile(apiUrl: string): void {
  const envPath = join(process.cwd(), '.env');

  try {
    let envContent = readFileSync(envPath, 'utf-8');

    // Check if EXPO_PUBLIC_API_URL exists
    const apiUrlRegex = /^EXPO_PUBLIC_API_URL=.*$/m;

    if (apiUrlRegex.test(envContent)) {
      // Replace existing value
      envContent = envContent.replace(apiUrlRegex, `EXPO_PUBLIC_API_URL=${apiUrl}`);
    } else {
      // Add new line if it doesn't exist
      envContent += `\nEXPO_PUBLIC_API_URL=${apiUrl}\n`;
    }

    writeFileSync(envPath, envContent, 'utf-8');
    console.log(`✅ Updated .env with API URL: ${apiUrl}`);
  } catch (error) {
    console.error('❌ Failed to update .env file:', error);
    process.exit(1);
  }
}

/**
 * Starts the API server with tsx watch
 */
function startApiServer(): void {
  console.log('🚀 Starting API server with hot-reload...\n');

  const apiProcess = spawn('npx', ['tsx', 'watch', 'api/server.ts'], {
    stdio: 'inherit',
    shell: true,
  });

  // Handle process termination
  apiProcess.on('error', (error) => {
    console.error('❌ Failed to start API server:', error);
    process.exit(1);
  });

  apiProcess.on('exit', (code) => {
    console.log(`\n📊 API server exited with code ${code}`);
    process.exit(code ?? 0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n⏹️  Stopping API server...');
    apiProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('\n⏹️  Stopping API server...');
    apiProcess.kill('SIGTERM');
  });
}

/**
 * Main execution
 */
function main(): void {
  console.log('🔧 Auto-configuring API environment...\n');

  // Get configuration
  const localIP = getLocalNetworkIP();
  const apiPort = process.env.API_PORT ?? '3000';
  const apiUrl = `http://${localIP}:${apiPort}`;

  console.log(`📡 Detected local IP: ${localIP}`);
  console.log(`🔌 Using port: ${apiPort}`);
  console.log(`🌐 API URL: ${apiUrl}\n`);

  // Update .env file
  updateEnvFile(apiUrl);

  // Start the API server
  startApiServer();
}

// Run the script
main();
