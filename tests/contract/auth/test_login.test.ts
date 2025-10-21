/**
 * Contract Test: POST /auth/login
 * 
 * This test validates the login endpoint contract according to the API specification.
 * It tests authentication via email or phone number with OTP delivery.
 * 
 * CRITICAL: This test MUST FAIL before implementation as per TDD requirements.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { ContractTestEnvironment, createContractTestEnvironment } from '../helpers/environment';

describe('POST /auth/login Contract Tests', () => {
  let ctx: ContractTestEnvironment;

  beforeEach(async () => {
    ctx = await createContractTestEnvironment();
  });

  describe('Email Authentication', () => {
    it('should accept valid email and return OTP session', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { email: ctx.integration.user.email },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'OTP sent to your email');
      expect(response.body).toHaveProperty('session_id');
      expect(response.body.session_id).toMatch(/^sess_[a-zA-Z0-9]+$/);
      expect(ctx.integration.stubs.otpSender.lastEmailOtp).not.toBeNull();
      expect(ctx.integration.stubs.otpSender.lastEmailOtp?.email).toBe(ctx.integration.user.email);
    });

    it('should reject invalid email format', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { email: 'invalid-email' },
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    });
  });

  describe('Phone Authentication', () => {
    it('should accept valid Kenyan phone number and return OTP session', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { phone: ctx.integration.user.phone! },
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'OTP sent to your phone');
      expect(response.body.session_id).toMatch(/^sess_[a-zA-Z0-9]+$/);
      expect(ctx.integration.stubs.otpSender.lastSmsOtp).not.toBeNull();
      expect(ctx.integration.stubs.otpSender.lastSmsOtp?.phone).toBe(ctx.integration.user.phone);
    });

    it('should reject invalid phone number format', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { phone: '123456789' },
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid phone number format',
        code: 'INVALID_PHONE',
      });
    });
  });

  describe('Request Validation', () => {
    it('should reject request with both email and phone', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { email: ctx.integration.user.email, phone: ctx.integration.user.phone! },
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Provide either email or phone, not both',
        code: 'INVALID_REQUEST',
      });
    });

    it('should reject request with neither email nor phone', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: {},
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Email or phone number is required',
        code: 'MISSING_CREDENTIALS',
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting with 429 status', async () => {
      ctx.integration.stubs.rateLimiter.consume = async () => ({ allowed: false, retryAfterSeconds: 60 });

      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { email: ctx.integration.user.email },
      });

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        error: 'Too many login attempts',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    });
  });

  describe('Response Schema Validation', () => {
    it('should return response matching OpenAPI schema', async () => {
      const response = await ctx.execute(ctx.routes.auth.login, {
        body: { email: ctx.integration.user.email },
      });

      expect(response.status).toBe(200);
      expect(typeof response.body.message).toBe('string');
      expect(typeof response.body.session_id).toBe('string');
      expect(response.body.session_id).toMatch(/^sess_[a-zA-Z0-9]+$/);
    });
  });
});