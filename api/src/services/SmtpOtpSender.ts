import type { OtpSender } from './types';

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
};

export class SmtpOtpSender implements OtpSender {
  private readonly config: SmtpConfig;

  constructor(config: SmtpConfig) {
    this.config = config;
  }

  async sendEmailOtp(email: string, otpCode: string): Promise<void> {
    // Dynamically import nodemailer to avoid loading unless needed
    const mod = await import('nodemailer');
    const nodemailer: any = (mod as any).default ?? mod;

    const transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });

    const subject = 'Your Zanari OTP Code';
    const text = `Your One-Time Password (OTP) is: ${otpCode}\nThis code expires shortly. If you did not request this, you can ignore this email.`;
    const html = `<p>Your One-Time Password (OTP) is: <strong>${otpCode}</strong></p><p>This code expires shortly. If you did not request this, you can ignore this email.</p>`;

    await transporter.sendMail({
      from: this.config.fromAddress,
      to: email,
      subject,
      text,
      html,
    });
  }

  async sendSmsOtp(phone: string, otpCode: string): Promise<void> {
    // No SMS provider configured; log to console as a fallback
    // You can replace this with an actual SMS gateway integration later.
    console.info(`[OTP] SMS -> ${phone}: ${otpCode}`);
  }
}
