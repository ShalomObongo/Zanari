/**
 * AuthService manages user authentication lifecycles including OTP login, PIN setup, and verification lockouts.
 */

import { randomBytes } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthSession, SUPABASE_EMAIL_OTP_CODE, createAuthSession, generateOtpCode } from '../models/AuthSession';
import { ValidationError, UUID } from '../models/base';
import { User, validateUser } from '../models/User';
import {
  AuthSessionRepository,
  Clock,
  Logger,
  NullLogger,
  OtpSender,
  PinHasher,
  PinTokenService,
  RateLimiter,
  SystemClock,
  TokenService,
  UserRepository,
} from './types';

export interface VerifyPinResult {
  verified: boolean;
  token?: string;
  attemptsRemaining: number;
  lockedUntil?: Date;
}

export interface RequestOtpInput {
  email?: string;
  phone?: string;
}

export interface RequestOtpResult {
  message: string;
  sessionId: string;
  deliveryChannel: 'email' | 'sms';
}

export interface VerifyOtpInput {
  sessionId: string;
  otpCode: string;
}

export interface VerifyOtpResult {
  accessToken: string;
  refreshToken: string;
  user: User;
  requiresPinSetup: boolean;
}

const PIN_REGEX = /^[0-9]{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KENYAN_PHONE_REGEX = /^254[0-9]{9}$/;
const MAX_ATTEMPTS = 5;
const PROGRESSIVE_DELAYS_SECONDS = [0, 30, 120, 300, 900]; // 0, 30s, 2m, 5m, 15m
const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const PIN_TOKEN_TTL_SECONDS = 5 * 60;

const NullRateLimiter: RateLimiter = {
  async consume() {
    return { allowed: true };
  },
};

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly authSessionRepository: AuthSessionRepository;
  private readonly otpSender: OtpSender;
  private readonly tokenService: TokenService;
  private readonly pinHasher: PinHasher;
  private readonly pinTokenService: PinTokenService;
  private readonly rateLimiter: RateLimiter;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly supabaseClient?: SupabaseClient;
  private readonly emailOtpStrategy: 'custom' | 'supabase';

  constructor(options: {
    userRepository: UserRepository;
    authSessionRepository: AuthSessionRepository;
    otpSender: OtpSender;
    tokenService: TokenService;
    pinHasher: PinHasher;
    pinTokenService: PinTokenService;
    rateLimiter?: RateLimiter;
    clock?: Clock;
    logger?: Logger;
    supabaseClient?: SupabaseClient;
    emailOtpStrategy?: 'custom' | 'supabase';
  }) {
    this.userRepository = options.userRepository;
    this.authSessionRepository = options.authSessionRepository;
    this.otpSender = options.otpSender;
    this.tokenService = options.tokenService;
    this.pinHasher = options.pinHasher;
    this.pinTokenService = options.pinTokenService;
    this.rateLimiter = options.rateLimiter ?? NullRateLimiter;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? NullLogger;
    this.supabaseClient = options.supabaseClient;
    this.emailOtpStrategy = options.emailOtpStrategy ?? 'custom';

    if (this.emailOtpStrategy === 'supabase' && !this.supabaseClient) {
      throw new Error('Supabase client must be provided when using Supabase email OTP strategy.');
    }
  }

  async requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
    const { contactType, normalizedEmail, normalizedPhone } = this.validateContact(input);

    const rateKey = contactType === 'email' ? `login:email:${normalizedEmail}` : `login:phone:${normalizedPhone}`;
    const rate = await this.rateLimiter.consume(rateKey, { points: 1, durationSeconds: 60 });
    if (!rate.allowed) {
      throw new ValidationError('Too many login attempts', 'RATE_LIMIT_EXCEEDED');
    }

    const user = await this.lookupUser(normalizedEmail, normalizedPhone);
    if (!user) {
      throw new ValidationError('Account not found', 'ACCOUNT_NOT_FOUND');
    }

    const useSupabaseEmailOtp = this.shouldUseSupabaseEmailOtp(contactType);
    const otpCode = useSupabaseEmailOtp ? SUPABASE_EMAIL_OTP_CODE : generateOtpCode();
    const session = createAuthSession({
      userId: user.id,
      email: contactType === 'email' ? user.email : null,
      phone: contactType === 'sms' ? (user.phone ?? normalizedPhone) : null,
      otpCode,
      ttlSeconds: OTP_TTL_SECONDS,
    });

    await this.authSessionRepository.create(session);

    let message: string;
    if (contactType === 'email') {
      await this.otpSender.sendEmailOtp(session.email!, otpCode);
      message = 'OTP sent to your email';
    } else {
      await this.otpSender.sendSmsOtp(session.phone!, otpCode);
      message = 'OTP sent to your phone';

      const emailFallback = user.email?.trim();
      if (emailFallback && this.emailOtpStrategy !== 'supabase') {
        try {
          await this.otpSender.sendEmailOtp(emailFallback, otpCode);
          message = 'OTP sent to your phone and email';
        } catch (error) {
          this.logger.warn('Failed to send OTP email fallback', {
            userId: user.id,
            sessionId: session.id,
            error: error instanceof Error ? error.message : 'unknown_error',
          });
        }
      }
    }

    this.logger.info('OTP session created', { userId: user.id, sessionId: session.id, contactType });

    return {
      message,
      sessionId: session.id,
      deliveryChannel: contactType,
    };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    if (!/^[0-9]{6}$/.test(input.otpCode)) {
      throw new ValidationError('OTP must be a 6-digit code', 'INVALID_OTP');
    }

    const session = await this.requireSession(input.sessionId);
    const now = this.clock.now();

    if (session.verifiedAt) {
      throw new ValidationError('OTP already used', 'OTP_ALREADY_USED');
    }

    if (session.expiresAt.getTime() < now.getTime()) {
      await this.authSessionRepository.delete(session.id);
      throw new ValidationError('OTP expired', 'OTP_EXPIRED');
    }

    if (session.attemptCount >= session.maxAttempts) {
      throw new ValidationError('Maximum OTP attempts exceeded', 'OTP_ATTEMPTS_EXCEEDED');
    }

    const isSupabaseEmailOtp = session.otpCode === SUPABASE_EMAIL_OTP_CODE;

    if (isSupabaseEmailOtp) {
      const verificationResult = await this.verifyWithSupabaseEmailOtp(session, input.otpCode);

      if (verificationResult === 'expired') {
        await this.authSessionRepository.delete(session.id);
        throw new ValidationError('OTP expired', 'OTP_EXPIRED');
      }

      if (verificationResult === 'invalid') {
        session.attemptCount += 1;
        session.updatedAt = now;
        await this.authSessionRepository.save(session);
        throw new ValidationError('Invalid OTP code', 'INVALID_OTP');
      }
    } else if (session.otpCode !== input.otpCode) {
      session.attemptCount += 1;
      session.updatedAt = now;
      await this.authSessionRepository.save(session);
      throw new ValidationError('Invalid OTP code', 'INVALID_OTP');
    }

    session.verifiedAt = now;
    session.updatedAt = now;
    session.attemptCount += 1;
    await this.authSessionRepository.save(session);

    const user = await this.resolveUser(session);

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.issueAccessToken(user),
      this.tokenService.issueRefreshToken(user),
    ]);

    return {
      accessToken,
      refreshToken,
      user,
      requiresPinSetup: !user.pinHash,
    };
  }

  async updateProfile(
    userId: UUID,
    input: { firstName?: string; lastName?: string; email?: string; phone?: string },
  ): Promise<User> {
    const hasUpdates =
      input.firstName !== undefined ||
      input.lastName !== undefined ||
      input.email !== undefined ||
      input.phone !== undefined;

    if (!hasUpdates) {
      throw new ValidationError('No profile fields provided', 'INVALID_PROFILE_UPDATE');
    }

    const user = await this.requireUser(userId);
    const now = this.clock.now();
    const patch: Partial<User> = {};
    const updatedFields: string[] = [];

    if (input.firstName !== undefined) {
      const trimmed = input.firstName.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        throw new ValidationError('First name must be between 2 and 50 characters', 'INVALID_FIRST_NAME');
      }
      if (trimmed !== user.firstName) {
        patch.firstName = trimmed;
        updatedFields.push('first_name');
      }
    }

    if (input.lastName !== undefined) {
      const trimmed = input.lastName.trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        throw new ValidationError('Last name must be between 2 and 50 characters', 'INVALID_LAST_NAME');
      }
      if (trimmed !== user.lastName) {
        patch.lastName = trimmed;
        updatedFields.push('last_name');
      }
    }

    if (input.email !== undefined) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ValidationError('Invalid email format', 'INVALID_EMAIL');
      }
      if (normalizedEmail !== user.email) {
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if (existing && existing.id !== user.id) {
          throw new ValidationError('Account already exists for this email', 'ACCOUNT_EXISTS');
        }
        patch.email = normalizedEmail;
        updatedFields.push('email');
      }
    }

    if (input.phone !== undefined) {
      const normalizedPhone = input.phone.trim();
      if (!normalizedPhone) {
        throw new ValidationError('Phone number is required', 'INVALID_PHONE');
      }
      if (!KENYAN_PHONE_REGEX.test(normalizedPhone)) {
        throw new ValidationError('Invalid phone number format', 'INVALID_PHONE');
      }
      if (normalizedPhone !== (user.phone ?? null)) {
        const existing = await this.userRepository.findByPhone(normalizedPhone);
        if (existing && existing.id !== user.id) {
          throw new ValidationError('Account already exists for this phone number', 'ACCOUNT_EXISTS');
        }
        patch.phone = normalizedPhone;
        updatedFields.push('phone');
      }
    }

    if (updatedFields.length === 0) {
      return user;
    }

    patch.updatedAt = now;

    const updated = await this.userRepository.update(user.id, patch);
    validateUser(updated);

    this.logger.info('User profile updated', {
      userId: user.id,
      updatedFields,
    });

    return updated;
  }

  async setupPin(userId: UUID, pin: string): Promise<User> {
    this.assertValidPin(pin);

    const user = await this.requireUser(userId);
    const hashed = await this.pinHasher.hash(pin);
    const now = this.clock.now();

    const updated = await this.userRepository.update(user.id, {
      pinHash: hashed,
      pinSetAt: now,
      failedPinAttempts: 0,
      lastFailedAttemptAt: null,
      updatedAt: now,
    });

    validateUser(updated);
    this.logger.info('PIN setup completed', { userId: user.id });
    return updated;
  }

  async verifyPin(userId: UUID, pin: string): Promise<VerifyPinResult> {
    this.assertValidPin(pin);

    const user = await this.requireUser(userId);
    if (!user.pinHash) {
      throw new ValidationError('PIN not set', 'PIN_NOT_SET');
    }

    const now = this.clock.now();
    const lockedUntil = this.computeLockedUntil(user);
    if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
      return this.recordFailedAttempt(user);
    }

    const matched = await this.pinHasher.compare(pin, user.pinHash);
    if (!matched) {
      return this.recordFailedAttempt(user);
    }

    const token = this.generatePinToken();
    const updated = await this.userRepository.update(user.id, {
      failedPinAttempts: 0,
      lastFailedAttemptAt: null,
      updatedAt: now,
    });
    validateUser(updated);

    await this.pinTokenService.issue(user.id, token, PIN_TOKEN_TTL_SECONDS);

    return {
      verified: true,
      token,
      attemptsRemaining: MAX_ATTEMPTS,
    };
  }

  async validatePinToken(userId: UUID, token: string): Promise<boolean> {
    if (!token.startsWith('txn_')) {
      return false;
    }
    return this.pinTokenService.validate(userId, token);
  }

  async invalidatePinToken(token: string): Promise<void> {
    await this.pinTokenService.invalidate(token);
  }

  private assertValidPin(pin: string): void {
    if (!PIN_REGEX.test(pin)) {
      throw new ValidationError('PIN must be a 4-digit numeric code', 'INVALID_PIN_FORMAT');
    }
  }

  private async requireUser(userId: UUID): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', 'USER_NOT_FOUND');
    }
    return user;
  }

  private async requireSession(sessionId: string): Promise<AuthSession> {
    const session = await this.authSessionRepository.findById(sessionId);
    if (!session) {
      throw new ValidationError('Session not found', 'SESSION_NOT_FOUND');
    }
    return session;
  }

  private async resolveUser(session: AuthSession): Promise<User> {
    if (session.userId) {
      const user = await this.userRepository.findById(session.userId);
      if (user) {
        return user;
      }
    }

    if (session.email) {
      const user = await this.userRepository.findByEmail(session.email);
      if (user) {
        return user;
      }
    }

    if (session.phone) {
      const user = await this.userRepository.findByPhone(session.phone);
      if (user) {
        return user;
      }
    }

    throw new ValidationError('User not found for session', 'USER_NOT_FOUND');
  }

  private computeLockedUntil(user: User): Date | null {
    if (user.failedPinAttempts <= 0 || !user.lastFailedAttemptAt) {
      return null;
    }

    const delayIndex = Math.min(user.failedPinAttempts, PROGRESSIVE_DELAYS_SECONDS.length - 1);
    const delaySeconds = PROGRESSIVE_DELAYS_SECONDS[delayIndex] ?? 0;
    if (delaySeconds === 0) {
      return null;
    }

    const lockedUntil = new Date(user.lastFailedAttemptAt.getTime() + delaySeconds * 1000);
    return lockedUntil;
  }

  private async recordFailedAttempt(user: User): Promise<VerifyPinResult> {
    const now = this.clock.now();
    const failedAttempts = Math.min(MAX_ATTEMPTS, user.failedPinAttempts + 1);
    const lockedUntil = this.computeLockedUntil({
      ...user,
      failedPinAttempts: failedAttempts,
      lastFailedAttemptAt: now,
    });

    await this.userRepository.update(user.id, {
      failedPinAttempts: failedAttempts,
      lastFailedAttemptAt: now,
      updatedAt: now,
    });

    this.logger.warn('PIN verification failed', {
      userId: user.id,
      failedAttempts,
      lockedUntil: lockedUntil?.toISOString(),
    });

    return {
      verified: false,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts),
      lockedUntil: lockedUntil ?? undefined,
    };
  }

  private async lookupUser(email: string | null, phone: string | null): Promise<User | null> {
    if (email) {
      const byEmail = await this.userRepository.findByEmail(email);
      if (byEmail) {
        return byEmail;
      }
    }
    if (phone) {
      const byPhone = await this.userRepository.findByPhone(phone);
      if (byPhone) {
        return byPhone;
      }
    }
    return null;
  }

  private async verifyWithSupabaseEmailOtp(
    session: AuthSession,
    otpCode: string,
  ): Promise<'ok' | 'invalid' | 'expired'> {
    if (!this.supabaseClient) {
      this.logger.error('Supabase client not configured for email OTP verification', { sessionId: session.id });
      throw new Error('Supabase client not configured for email OTP verification.');
    }

    if (!session.email) {
      this.logger.error('Supabase email OTP session missing email', { sessionId: session.id });
      throw new Error('Supabase email OTP session missing email.');
    }

    try {
      await this.supabaseClient.auth.verifyOtp({
        email: session.email,
        token: otpCode,
        type: 'email',
      });
      return 'ok';
    } catch (error) {
      const authError = error as { message: string; status?: number };
      const status = authError?.status;
      this.logger.warn('Supabase email OTP verification failed', {
        sessionId: session.id,
        email: session.email,
        error: authError?.message ?? 'unknown_error',
        status,
      });

      if (status === 410) {
        return 'expired';
      }

      return 'invalid';
    }
  }

  private shouldUseSupabaseEmailOtp(contactType: 'email' | 'sms'): boolean {
    return contactType === 'email' && this.emailOtpStrategy === 'supabase';
  }

  private validateContact(input: RequestOtpInput): {
    contactType: 'email' | 'sms';
    normalizedEmail: string | null;
    normalizedPhone: string | null;
  } {
    const hasEmail = typeof input.email === 'string' && input.email.trim().length > 0;
    const hasPhone = typeof input.phone === 'string' && input.phone.trim().length > 0;

    if (hasEmail && hasPhone) {
      throw new ValidationError('Provide either email or phone, not both', 'INVALID_REQUEST');
    }
    if (!hasEmail && !hasPhone) {
      throw new ValidationError('Email or phone number is required', 'MISSING_CREDENTIALS');
    }

    if (hasEmail) {
      const normalizedEmail = input.email!.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new ValidationError('Invalid email format', 'INVALID_EMAIL');
      }
      return {
        contactType: 'email',
        normalizedEmail,
        normalizedPhone: null,
      };
    }

    const normalizedPhone = input.phone!.trim();
    if (!KENYAN_PHONE_REGEX.test(normalizedPhone)) {
      throw new ValidationError('Invalid phone number format', 'INVALID_PHONE');
    }

    return {
      contactType: 'sms',
      normalizedEmail: null,
      normalizedPhone,
    };
  }

  private generatePinToken(): string {
    return `txn_${randomBytes(16).toString('hex')}`;
  }
}
