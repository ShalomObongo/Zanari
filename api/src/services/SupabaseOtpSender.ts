import type { SupabaseClient } from '@supabase/supabase-js';

import { Logger, NullLogger, OtpSender } from './types';

interface SupabaseOtpSenderOptions {
  client: SupabaseClient;
  logger?: Logger;
  smsFallback?: OtpSender;
}

/**
 * Delegates OTP delivery to Supabase's native email/SMS providers.
 * Supabase manages the actual OTP code generation, so the provided otpCode is ignored.
 */
export class SupabaseOtpSender implements OtpSender {
  private readonly client: SupabaseClient;
  private readonly logger: Logger;
  private readonly smsFallback?: OtpSender;

  constructor({ client, logger, smsFallback }: SupabaseOtpSenderOptions) {
    this.client = client;
    this.logger = logger ?? NullLogger;
    this.smsFallback = smsFallback;
  }

  async sendEmailOtp(email: string, _otpCode: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      this.logger.error('Failed to send Supabase email OTP', {
        email,
        error: error.message,
      });
      throw new Error(`Failed to send Supabase email OTP: ${error.message}`);
    }

    this.logger.info('Supabase email OTP dispatched', { email });
  }

  async sendSmsOtp(phone: string, otpCode: string): Promise<void> {
    const { data, error } = await this.client.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: false,
        channel: 'sms',
      },
    });

    if (error) {
      this.logger.warn('Supabase SMS OTP dispatch failed; attempting fallback', {
        phone,
        error: error.message,
      });
      if (this.smsFallback) {
        await this.smsFallback.sendSmsOtp(phone, otpCode);
        return;
      }
      throw new Error(`Failed to send Supabase SMS OTP: ${error.message}`);
    }

    this.logger.info('Supabase SMS OTP dispatched', {
      phone,
      messageId: data?.messageId ?? null,
    });
  }
}
