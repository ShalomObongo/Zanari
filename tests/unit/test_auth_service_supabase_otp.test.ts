import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthService } from '../../api/src/services/AuthService';
import { SupabaseOtpSender } from '../../api/src/services/SupabaseOtpSender';
import {
  AuthSessionRepository,
  OtpSender,
  PinHasher,
  PinTokenService,
  RateLimiter,
  TokenService,
  UserRepository,
  NullLogger,
} from '../../api/src/services/types';
import { createUser, User } from '../../api/src/models/User';
import { AuthSession, SUPABASE_EMAIL_OTP_CODE } from '../../api/src/models/AuthSession';
import { ValidationError, UUID } from '../../api/src/models/base';

type SupabaseAuthMock = {
  signInWithOtp: jest.MockedFunction<
    (...args: unknown[]) => Promise<{ data: { user: null; session: null }; error: null }>
  >;
  verifyOtp: jest.MockedFunction<(...args: unknown[]) => Promise<void>>;
};

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<UUID, User>();

  async create(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return { ...user };
  }

  async findById(userId: UUID): Promise<User | null> {
    const user = this.users.get(userId);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.phone === phone) {
        return { ...user };
      }
    }
    return null;
  }

  async update(userId: UUID, update: Partial<User>): Promise<User> {
    const current = this.users.get(userId);
    if (!current) {
      throw new Error('User not found');
    }
    const next = { ...current, ...update, updatedAt: update.updatedAt ?? new Date() } satisfies User;
    this.users.set(userId, next);
    return { ...next };
  }
}

class InMemoryAuthSessionRepository implements AuthSessionRepository {
  private readonly sessions = new Map<string, AuthSession>();

  async create(session: AuthSession): Promise<AuthSession> {
    this.sessions.set(session.id, { ...session });
    return { ...session };
  }

  async findById(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async save(session: AuthSession): Promise<AuthSession> {
    this.sessions.set(session.id, { ...session });
    return { ...session };
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class AllowAllRateLimiter implements RateLimiter {
  async consume(
    _key: string,
    _options?: { points?: number; durationSeconds?: number },
  ): Promise<{ allowed: boolean }> {
    return { allowed: true };
  }
}

class StubPinHasher implements PinHasher {
  async hash(pin: string): Promise<string> {
    return `hash:${pin}`;
  }

  async compare(pin: string, hash: string): Promise<boolean> {
    return hash === `hash:${pin}`;
  }
}

class StubPinTokenService implements PinTokenService {
  async issue(): Promise<void> {}
  async validate(): Promise<boolean> {
    return true;
  }
  async invalidate(): Promise<void> {}
}

class StaticTokenService implements TokenService {
  async issueAccessToken(_user: User): Promise<string> {
    return 'access-token';
  }

  async issueRefreshToken(_user: User): Promise<string> {
    return 'refresh-token';
  }

  async revokeRefreshToken(_refreshToken: string): Promise<void> {}
}

class NoopSmsOtpSender implements OtpSender {
  async sendEmailOtp(_email: string, _otpCode: string): Promise<void> {}
  async sendSmsOtp(_phone: string, _otpCode: string): Promise<void> {}
}

describe('AuthService with Supabase email OTP', () => {
  const user = createUser({
    id: randomUUID(),
    email: 'supabase.user@example.com',
    phone: '254711223344',
    firstName: 'Supabase',
    lastName: 'User',
  });

  let userRepository: InMemoryUserRepository;
  let authSessionRepository: InMemoryAuthSessionRepository;
  let supabaseAuth: SupabaseAuthMock;
  let supabaseClient: SupabaseClient;
  let authService: AuthService;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    authSessionRepository = new InMemoryAuthSessionRepository();
    supabaseAuth = {
      signInWithOtp: jest
        .fn<(...args: unknown[]) => Promise<{ data: { user: null; session: null }; error: null }>>()
        .mockResolvedValue({ data: { user: null, session: null }, error: null }),
      verifyOtp: jest.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
    };
    supabaseClient = { auth: supabaseAuth } as unknown as SupabaseClient;

    const otpSender = new SupabaseOtpSender({
      client: supabaseClient,
      logger: NullLogger,
      smsFallback: new NoopSmsOtpSender(),
    });

    authService = new AuthService({
      userRepository,
      authSessionRepository,
      otpSender,
      tokenService: new StaticTokenService(),
      pinHasher: new StubPinHasher(),
      pinTokenService: new StubPinTokenService(),
      rateLimiter: new AllowAllRateLimiter(),
      logger: NullLogger,
      supabaseClient,
      emailOtpStrategy: 'supabase',
    });
  });

  it('creates Supabase-managed OTP sessions and triggers Supabase delivery', async () => {
    await userRepository.create(user);

    const result = await authService.requestOtp({ email: user.email });

    expect(result.deliveryChannel).toBe('email');
    expect(supabaseAuth.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(supabaseAuth.signInWithOtp).toHaveBeenCalledWith({
      email: user.email,
      options: expect.objectContaining({ shouldCreateUser: false }),
    });

    const session = await authSessionRepository.findById(result.sessionId);
    expect(session).not.toBeNull();
    expect(session?.otpCode).toBe(SUPABASE_EMAIL_OTP_CODE);
  });

  it('verifies OTP via Supabase and issues tokens on success', async () => {
    await userRepository.create(user);
    const { sessionId } = await authService.requestOtp({ email: user.email });

    const result = await authService.verifyOtp({ sessionId, otpCode: '123456' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(supabaseAuth.verifyOtp).toHaveBeenCalledWith({
      email: user.email,
      token: '123456',
      type: 'email',
    });

    const session = await authSessionRepository.findById(sessionId);
    expect(session?.verifiedAt).not.toBeNull();
  });

  it('increments attempt count when Supabase rejects the OTP', async () => {
    await userRepository.create(user);
    const { sessionId } = await authService.requestOtp({ email: user.email });

    const error = new Error('Invalid token') as Error & { status?: number };
    error.status = 400;
    supabaseAuth.verifyOtp.mockRejectedValueOnce(error);

    await expect(authService.verifyOtp({ sessionId, otpCode: '999999' })).rejects.toThrow(ValidationError);

    const session = await authSessionRepository.findById(sessionId);
    expect(session?.attemptCount).toBe(1);
  });

  it('deletes session when Supabase reports an expired token', async () => {
    await userRepository.create(user);
    const { sessionId } = await authService.requestOtp({ email: user.email });

    const expiredError = new Error('Token expired') as Error & { status?: number };
    expiredError.status = 410;
    supabaseAuth.verifyOtp.mockRejectedValueOnce(expiredError);

    await expect(authService.verifyOtp({ sessionId, otpCode: '111111' })).rejects.toThrow(ValidationError);

    const session = await authSessionRepository.findById(sessionId);
    expect(session).toBeNull();
  });
});
