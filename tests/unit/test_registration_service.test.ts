import { describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { RegistrationService } from '../../api/src/services/RegistrationService';
import { InMemoryIdentityProvider } from '../../api/src/services/IdentityProvider';
import { AuthService } from '../../api/src/services/AuthService';
import { ValidationError, UUID } from '../../api/src/models/base';
import { createUser, User } from '../../api/src/models/User';
import { AuthSession } from '../../api/src/models/AuthSession';
import {
  AuthSessionRepository,
  IdentityProvider,
  OtpSender,
  RateLimiter,
  TokenService,
  PinHasher,
  PinTokenService,
  UserRepository,
} from '../../api/src/services/types';
import { RandomTokenService } from '../../api/src/services/RandomTokenService';
import { CryptoPinHasher } from '../../api/src/services/CryptoPinHasher';
import { InMemoryRateLimiter } from '../../api/src/services/InMemoryRateLimiter';
import { ConsoleOtpSender } from '../../api/src/services/ConsoleOtpSender';

class InMemoryUserRepo implements UserRepository {
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

class InMemoryAuthSessionRepo implements AuthSessionRepository {
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

class StubPinTokenService implements PinTokenService {
  async issue(): Promise<void> {}
  async validate(): Promise<boolean> {
    return true;
  }
  async invalidate(): Promise<void> {}
}

const buildRegistrationService = () => {
  const userRepository = new InMemoryUserRepo();
  const authSessionRepository = new InMemoryAuthSessionRepo();
  const otpSender: OtpSender = new ConsoleOtpSender();
  const tokenService: TokenService = new RandomTokenService();
  const pinHasher: PinHasher = new CryptoPinHasher();
  const pinTokenService: PinTokenService = new StubPinTokenService();
  const rateLimiter: RateLimiter = new InMemoryRateLimiter();
  const identityProvider: IdentityProvider = new InMemoryIdentityProvider();

  const authService = new AuthService({
    userRepository,
    authSessionRepository,
    otpSender,
    tokenService,
    pinHasher,
    pinTokenService,
    rateLimiter,
  });

  const registrationService = new RegistrationService({
    userRepository,
    identityProvider,
    authService,
  });

  return { registrationService, userRepository };
};

describe('RegistrationService', () => {
  it('registers a new user and triggers OTP', async () => {
    const { registrationService, userRepository } = buildRegistrationService();

    const result = await registrationService.register({
      firstName: 'Joy',
      lastName: 'Kamau',
      email: 'joy.kamau@example.com',
      phone: '254700111222',
    });

    expect(result.sessionId).toMatch(/^sess_/);
    expect(result.deliveryChannel).toBe('sms');

    const stored = await userRepository.findByEmail('joy.kamau@example.com');
    expect(stored).not.toBeNull();
    expect(stored?.firstName).toBe('Joy');
  });

  it('throws when email already exists', async () => {
    const { registrationService, userRepository } = buildRegistrationService();
    const existingUser = createUser({
      id: randomUUID(),
      email: 'dup@example.com',
      phone: '254711111111',
      firstName: 'Existing',
      lastName: 'User',
    });
    await userRepository.create(existingUser);

    await expect(
      registrationService.register({
        firstName: 'New',
        lastName: 'User',
        email: 'dup@example.com',
        phone: '254799999999',
      }),
    ).rejects.toThrow(ValidationError);
  });
});
