import { randomUUID } from 'node:crypto';

import { TokenService } from './types';
import { User } from '../models/User';

export class RandomTokenService implements TokenService {
  async issueAccessToken(user: User): Promise<string> {
    return `access-${user.id}-${randomUUID()}`;
  }

  async issueRefreshToken(user: User): Promise<string> {
    return `refresh-${user.id}-${randomUUID()}`;
  }

  async revokeRefreshToken(): Promise<void> {
    // No-op for development mode
  }
}
