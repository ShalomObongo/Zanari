import { beforeEach, describe, expect, it } from '@jest/globals';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /auth/verify-otp Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  async function createOtpSession() {
    const loginResponse = await ctx.execute(ctx.routes.auth.login, {
      body: { email: ctx.integration.user.email },
    });
    const sessionId = loginResponse.body.session_id as string;
    const otp = ctx.integration.stubs.otpSender.lastEmailOtp?.otp;
    if (!otp) {
      throw new Error('OTP was not generated');
    }
    return { sessionId, otp };
  }

  it('should verify valid OTP and return authentication tokens', async () => {
    const { sessionId, otp } = await createOtpSession();

    const response = await ctx.execute(ctx.routes.auth.verifyOtp, {
      body: { session_id: sessionId, otp_code: otp },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      requires_pin_setup: true,
    });
    expect(typeof response.body.access_token).toBe('string');
    expect(response.body.access_token).toContain('access-');
    expect(typeof response.body.refresh_token).toBe('string');
    expect(response.body.refresh_token).toContain('refresh-');
    expect(response.body.user).toMatchObject({
      id: ctx.integration.user.id,
      email: ctx.integration.user.email,
    });
  });

  it('should return requires_pin_setup=false for users with an existing PIN', async () => {
    await ctx.integration.helpers.ensurePin('1234');
    const { sessionId, otp } = await createOtpSession();

    const response = await ctx.execute(ctx.routes.auth.verifyOtp, {
      body: { session_id: sessionId, otp_code: otp },
    });

    expect(response.status).toBe(200);
    expect(response.body.requires_pin_setup).toBe(false);
  });

  it('should reject invalid OTP code', async () => {
    const { sessionId } = await createOtpSession();

    const response = await ctx.execute(ctx.routes.auth.verifyOtp, {
      body: { session_id: sessionId, otp_code: '000000' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('should validate OTP format', async () => {
    const response = await ctx.execute(ctx.routes.auth.verifyOtp, {
      body: { session_id: 'sess_invalid', otp_code: '12345' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_OTP',
    });
  });

  it('should require session_id in the request body', async () => {
    const response = await ctx.execute(ctx.routes.auth.verifyOtp, {
      body: { otp_code: '123456' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_SESSION_ID',
    });
  });
});