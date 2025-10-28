/**
 * Authentication HTTP route handlers.
 */

import { ValidationError } from '../models/base';
import { AuthService } from '../services/AuthService';
import { RegistrationService } from '../services/RegistrationService';
import { HttpError, badRequest, fromValidationError, tooManyRequests } from './errors';
import { ensureAuthenticated } from './handler';
import { created, ok } from './responses';
import { serializeUser } from './serializers';
import { HttpRequest } from './types';
import { requireString } from './validation';

interface LoginBody {
  email?: string;
  phone?: string;
}

interface RegisterBody {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

interface VerifyOtpBody {
  session_id?: string;
  otp_code?: string;
}

interface SetupPinBody {
  pin?: string;
  confirm_pin?: string;
}

interface VerifyPinBody {
  pin?: string;
}

interface UpdateProfileBody {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
}

export interface AuthRouteDependencies {
  authService: AuthService;
  registrationService: RegistrationService;
}

export function createAuthRoutes({ authService, registrationService }: AuthRouteDependencies) {
  return {
    register: async (request: HttpRequest<RegisterBody>) => {
      const firstName = requireString(request.body?.first_name, 'first_name is required', 'INVALID_FIRST_NAME');
      const lastName = requireString(request.body?.last_name, 'last_name is required', 'INVALID_LAST_NAME');
      const email = requireString(request.body?.email, 'email is required', 'INVALID_EMAIL');
      const phone = requireString(request.body?.phone, 'phone is required', 'INVALID_PHONE');

      try {
        const result = await registrationService.register({
          firstName,
          lastName,
          email,
          phone,
        });

        return created({
          message: result.message,
          session_id: result.sessionId,
          delivery_channel: result.deliveryChannel,
          user: serializeUser(result.user),
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

    login: async (request: HttpRequest<LoginBody>) => {
      try {
        const result = await authService.requestOtp(request.body ?? {});
        return ok({
          message: result.message,
          session_id: result.sessionId,
        });
      } catch (error) {
        if (error instanceof ValidationError && error.code === 'RATE_LIMIT_EXCEEDED') {
          throw tooManyRequests(error.message);
        }
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

    verifyOtp: async (request: HttpRequest<VerifyOtpBody>) => {
      const sessionId = requireString(request.body?.session_id, 'session_id is required', 'INVALID_SESSION_ID');
      const otpCode = requireString(request.body?.otp_code, 'otp_code is required', 'INVALID_OTP');

      try {
        const result = await authService.verifyOtp({ sessionId, otpCode });
        return ok({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          user: serializeUser(result.user),
          requires_pin_setup: result.requiresPinSetup,
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },

    setupPin: async (request: HttpRequest<SetupPinBody>) => {
      ensureAuthenticated(request);
      const pin = requireString(request.body?.pin, 'PIN is required', 'INVALID_PIN_FORMAT');
      const confirmPin = requireString(request.body?.confirm_pin, 'confirm_pin is required', 'INVALID_PIN_FORMAT');

      if (!/^[0-9]{4}$/.test(pin) || !/^[0-9]{4}$/.test(confirmPin)) {
        throw badRequest('PIN must be 4 numeric digits', 'INVALID_PIN_FORMAT');
      }
      if (pin !== confirmPin) {
        throw badRequest('PIN and confirm PIN must match', 'PIN_MISMATCH');
      }

      try {
        await authService.setupPin(request.userId, pin);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }

      return ok({ message: 'PIN setup completed successfully' });
    },

    verifyPin: async (request: HttpRequest<VerifyPinBody>) => {
      ensureAuthenticated(request);
      const pin = requireString(request.body?.pin, 'PIN is required', 'INVALID_PIN_FORMAT');
      if (!/^[0-9]{4}$/.test(pin)) {
        throw badRequest('PIN must be 4 numeric digits', 'INVALID_PIN_FORMAT');
      }

      try {
        const result = await authService.verifyPin(request.userId, pin);
        if (!result.verified) {
          const lockedUntil = result.lockedUntil ? result.lockedUntil.toISOString() : undefined;
          const details = {
            attempts_remaining: result.attemptsRemaining,
            ...(lockedUntil ? { locked_until: lockedUntil } : {}),
          };

          if (lockedUntil && result.attemptsRemaining === 0) {
            throw new HttpError(401, 'Account temporarily locked', 'PIN_LOCKED', details);
          }

          throw new HttpError(401, 'Invalid PIN', 'INVALID_PIN', details);
      }

      return ok({
        verified: true,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw fromValidationError(error);
      }
      throw error;
    }
    },

    updateProfile: async (request: HttpRequest<UpdateProfileBody>) => {
      ensureAuthenticated(request);

      const body = request.body ?? {};

      if (body.first_name !== undefined && typeof body.first_name !== 'string') {
        throw badRequest('first_name must be a string', 'INVALID_FIRST_NAME');
      }
      if (body.last_name !== undefined && typeof body.last_name !== 'string') {
        throw badRequest('last_name must be a string', 'INVALID_LAST_NAME');
      }
      if (body.email !== undefined && typeof body.email !== 'string') {
        throw badRequest('email must be a string', 'INVALID_EMAIL');
      }
      if (body.phone !== undefined && typeof body.phone !== 'string') {
        throw badRequest('phone must be a string', 'INVALID_PHONE');
      }

      try {
        const updated = await authService.updateProfile(request.userId!, {
          firstName: body.first_name as string | undefined,
          lastName: body.last_name as string | undefined,
          email: body.email as string | undefined,
          phone: body.phone as string | undefined,
        });

        return ok({
          user: serializeUser(updated),
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          throw fromValidationError(error);
        }
        throw error;
      }
    },
  };
}
