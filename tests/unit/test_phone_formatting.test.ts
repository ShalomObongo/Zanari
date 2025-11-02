import { formatPhoneNumber, formatPhoneForDisplay, isValidKenyanNumber } from '@/utils/phoneFormatting';

describe('phoneFormatting utilities', () => {
  describe('formatPhoneNumber', () => {
    it('formats numbers starting with 0', () => {
      expect(formatPhoneNumber('0712345678')).toBe('254712345678');
      expect(formatPhoneNumber('0112345678')).toBe('254112345678');
    });

    it('formats numbers starting with 7 or 1', () => {
      expect(formatPhoneNumber('712345678')).toBe('254712345678');
      expect(formatPhoneNumber('112345678')).toBe('254112345678');
    });

    it('keeps numbers already starting with 254', () => {
      expect(formatPhoneNumber('254712345678')).toBe('254712345678');
    });

    it('removes non-digit characters', () => {
      expect(formatPhoneNumber('0712-345-678')).toBe('254712345678');
      expect(formatPhoneNumber('(071) 234 5678')).toBe('254712345678');
    });
  });

  describe('formatPhoneForDisplay', () => {
    it('formats numbers with spaces (0XXX XXX XXX)', () => {
      expect(formatPhoneForDisplay('0712345678')).toBe('0712 345 678');
      expect(formatPhoneForDisplay('254712345678')).toBe('0712 345 678');
      expect(formatPhoneForDisplay('712345678')).toBe('0712 345 678');
    });

    it('handles partial numbers', () => {
      expect(formatPhoneForDisplay('071')).toBe('071');
      expect(formatPhoneForDisplay('0712')).toBe('0712');
      expect(formatPhoneForDisplay('07123')).toBe('0712 3');
      expect(formatPhoneForDisplay('0712345')).toBe('0712 345');
    });

    it('handles numbers with existing formatting', () => {
      expect(formatPhoneForDisplay('0712 345 678')).toBe('0712 345 678');
      expect(formatPhoneForDisplay('254 712 345 678')).toBe('0712 345 678');
    });
  });

  describe('isValidKenyanNumber', () => {
    it('validates correct Kenyan mobile numbers (7XX)', () => {
      expect(isValidKenyanNumber('254712345678')).toBe(true);
      expect(isValidKenyanNumber('254722345678')).toBe(true);
      expect(isValidKenyanNumber('254733345678')).toBe(true);
      expect(isValidKenyanNumber('254744345678')).toBe(true);
      expect(isValidKenyanNumber('254755345678')).toBe(true);
    });

    it('validates correct Kenyan mobile numbers (1XX)', () => {
      expect(isValidKenyanNumber('254112345678')).toBe(true);
    });

    it('rejects invalid formats', () => {
      // Too short
      expect(isValidKenyanNumber('25471234567')).toBe(false);
      // Too long
      expect(isValidKenyanNumber('2547123456789')).toBe(false);
      // Wrong country code
      expect(isValidKenyanNumber('255712345678')).toBe(false);
      // Wrong prefix (not 7 or 1)
      expect(isValidKenyanNumber('254812345678')).toBe(false);
      // Not starting with 254
      expect(isValidKenyanNumber('0712345678')).toBe(false);
    });
  });
});
