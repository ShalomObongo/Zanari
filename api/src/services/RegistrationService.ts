import { ValidationError } from '../models/base';
import { createUser, User } from '../models/User';
import { AuthService } from './AuthService';
import { IdentityProvider, UserRepository } from './types';

export interface RegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface RegistrationResult {
  user: User;
  sessionId: string;
  deliveryChannel: 'email' | 'sms';
  message: string;
}

export class RegistrationService {
  constructor(
    private readonly dependencies: {
      userRepository: UserRepository;
      identityProvider: IdentityProvider;
      authService: AuthService;
    },
  ) {}

  async register(input: RegistrationInput): Promise<RegistrationResult> {
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();

    if (!firstName) {
      throw new ValidationError('First name is required', 'INVALID_FIRST_NAME');
    }
    if (!lastName) {
      throw new ValidationError('Last name is required', 'INVALID_LAST_NAME');
    }
    if (!email) {
      throw new ValidationError('Email is required', 'INVALID_EMAIL');
    }
    if (!phone) {
      throw new ValidationError('Phone number is required', 'INVALID_PHONE');
    }

    const { userRepository, identityProvider, authService } = this.dependencies;

    const existingByEmail = await userRepository.findByEmail(email);
    if (existingByEmail) {
      throw new ValidationError('Account already exists for this email', 'ACCOUNT_EXISTS');
    }

    const existingByPhone = await userRepository.findByPhone(phone);
    if (existingByPhone) {
      throw new ValidationError('Account already exists for this phone number', 'ACCOUNT_EXISTS');
    }

    const { id } = await identityProvider.createIdentity({ email, phone });

    const user = createUser({
      id,
      email,
      phone,
      firstName,
      lastName,
    });

    const savedUser = await userRepository.create(user);

    const otpResult = await authService.requestOtp({ phone });

    return {
      user: savedUser,
      sessionId: otpResult.sessionId,
      deliveryChannel: otpResult.deliveryChannel,
      message: otpResult.message,
    };
  }
}
