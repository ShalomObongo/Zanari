import { beforeEach, describe, expect, it } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import { createIntegrationTestEnvironment, IntegrationTestEnvironment } from './helpers/environment';
import { createUser } from '../../api/src/models/User';

describe('Integration: Profile Update Flow', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(async () => {
    env = await createIntegrationTestEnvironment();
  });

  it('updates user profile details and persists changes', async () => {
    const updated = await env.services.authService.updateProfile(env.user.id, {
      firstName: 'Janet',
      lastName: 'Kariuki',
      email: 'janet.kariuki@zanari.app',
      phone: '254799988877',
    });

    expect(updated.firstName).toBe('Janet');
    expect(updated.lastName).toBe('Kariuki');
    expect(updated.email).toBe('janet.kariuki@zanari.app');
    expect(updated.phone).toBe('254799988877');

    const refreshed = await env.helpers.refreshUser();
    expect(refreshed.firstName).toBe('Janet');
    expect(refreshed.lastName).toBe('Kariuki');
    expect(refreshed.email).toBe('janet.kariuki@zanari.app');
    expect(refreshed.phone).toBe('254799988877');
  });

  it('rejects updates that conflict with existing user email', async () => {
    const other = createUser({
      id: randomUUID(),
      email: 'existing@zanari.app',
      phone: '254733333333',
      firstName: 'Existing',
      lastName: 'User',
    });

    await env.repositories.userRepository.create(other);

    await expect(
      env.services.authService.updateProfile(env.user.id, {
        email: other.email,
      }),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_EXISTS',
    });
  });
});

