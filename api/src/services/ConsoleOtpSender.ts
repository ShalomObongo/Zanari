import { OtpSender } from './types';

export class ConsoleOtpSender implements OtpSender {
  async sendEmailOtp(email: string, otpCode: string): Promise<void> {
    console.info(`[OTP] Email -> ${email}: ${otpCode}`);
  }

  async sendSmsOtp(phone: string, otpCode: string): Promise<void> {
    console.info(`[OTP] SMS -> ${phone}: ${otpCode}`);
  }
}
