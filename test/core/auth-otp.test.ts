import { describe, expect, it } from 'vitest';
import { generateOtpCode, hashOtp, normalizePhone } from '@/lib/core/auth/otp';

describe('auth/otp', () => {
  it('generates 4-digit codes', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(generateOtpCode()).toMatch(/^\d{4}$/);
    }
  });

  it('hashes deterministically and differs per code', async () => {
    expect(await hashOtp('1234')).toBe(await hashOtp('1234'));
    expect(await hashOtp('1234')).not.toBe(await hashOtp('5678'));
  });

  it('normalizes phone to digits only', () => {
    expect(normalizePhone('+7 (700) 902-09-88')).toBe('77009020988');
    expect(normalizePhone('8-777-000')).toBe('8777000');
  });
});
