import type { UserRepository, Logger } from '../services/types';
import { NullLogger } from '../services/types';
import { ensureAuthenticated } from './handler';
import { badRequest } from './errors';
import { ok } from './responses';
import { HttpRequest } from './types';
import { normalizeKenyanPhone, normalizeEmail } from './validation';

export interface UserRouteDependencies {
  userRepository: UserRepository;
  logger?: Logger;
}

export function createUserRoutes({
  userRepository,
  logger = NullLogger,
}: UserRouteDependencies) {
  return {
    lookupUser: async (request: HttpRequest<{ phone?: string; email?: string }>) => {
      ensureAuthenticated(request);

      const phone = request.query?.phone;
      const email = request.query?.email;

      if (!phone && !email) {
        throw badRequest('Phone or email parameter required', 'MISSING_LOOKUP_PARAM');
      }

      if (phone && email) {
        throw badRequest('Provide either phone or email, not both', 'CONFLICTING_LOOKUP_PARAMS');
      }

      try {
        let user = null;

        if (phone) {
          const normalizedPhone = normalizeKenyanPhone(phone);
          user = await userRepository.findByPhone(normalizedPhone);

          // Check if trying to lookup self
          if (user && user.id === request.userId) {
            logger.info('User lookup blocked: self-lookup', {
              userId: request.userId,
              phone: normalizedPhone,
            });
            return ok({
              exists: false,
              error: 'SELF_TRANSFER_NOT_ALLOWED',
              message: 'Cannot transfer to yourself',
            });
          }
        } else if (email) {
          const normalizedEmail = normalizeEmail(email);
          user = await userRepository.findByEmail(normalizedEmail);

          // Check if trying to lookup self
          if (user && user.id === request.userId) {
            logger.info('User lookup blocked: self-lookup', {
              userId: request.userId,
              email: normalizedEmail,
            });
            return ok({
              exists: false,
              error: 'SELF_TRANSFER_NOT_ALLOWED',
              message: 'Cannot transfer to yourself',
            });
          }
        }

        if (!user) {
          logger.info('User lookup: not found', {
            userId: request.userId,
            phone: phone ?? null,
            email: email ?? null,
          });
          return ok({
            exists: false,
            message: 'User not found',
          });
        }

        logger.info('User lookup: found', {
          userId: request.userId,
          recipientUserId: user.id,
          phone: phone ?? null,
          email: email ?? null,
        });

        return ok({
          exists: true,
          user_id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim() || null,
          phone: user.phone ?? null,
          email: user.email ?? null,
        });
      } catch (error) {
        if (error instanceof Error) {
          logger.error('User lookup failed', {
            userId: request.userId,
            error: error.message,
          });
          throw badRequest(error.message, 'LOOKUP_FAILED');
        }
        throw error;
      }
    },
  };
}
