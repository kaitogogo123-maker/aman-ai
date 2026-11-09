import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatKazakhstanAuthPhone, normalizeKazakhstanLocalPhoneInput } from '@/lib/core/auth/phone-input';

const authFlowSource = readFileSync(new URL('../../components/auth-flow.tsx', import.meta.url), 'utf8');

describe('Kazakhstan auth phone input', () => {
  it('lets users enter only the local number while submitting the full +7 phone', () => {
    expect(normalizeKazakhstanLocalPhoneInput('7086110912')).toBe('7086110912');
    expect(formatKazakhstanAuthPhone('7086110912')).toBe('+77000000099');
  });

  it('normalizes pasted full Kazakhstan numbers back to the local field value', () => {
    expect(normalizeKazakhstanLocalPhoneInput('+7 708 611 0912')).toBe('7086110912');
    expect(normalizeKazakhstanLocalPhoneInput('87086110912')).toBe('7086110912');
    expect(normalizeKazakhstanLocalPhoneInput('+77000000099')).toBe('7086110912');
  });

  it('uses the fixed +7 prefix in the auth flow UI and API payloads', () => {
    expect(authFlowSource).toContain("className=\"auth-phone-prefix\"");
    expect(authFlowSource).toContain('normalizeKazakhstanLocalPhoneInput(e.target.value)');
    expect(authFlowSource).toContain('const authPhone = formatKazakhstanAuthPhone(phone)');
    expect(authFlowSource).toContain("postAuth('login', { phone: authPhone, password })");
    expect(authFlowSource).toContain("postAuth('request-otp', { phone: authPhone, purpose })");
    expect(authFlowSource).toContain("postAuth('verify-otp', { phone: authPhone, purpose, code: joined })");
    expect(authFlowSource).toContain("postAuth('recover', { phone: authPhone, code: code.join(''), password: np })");
    expect(authFlowSource).toContain('<p className="auth-otp-phone">{authPhone}</p>');
  });
});
