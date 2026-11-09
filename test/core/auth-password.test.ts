import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/core/auth/password';

describe('auth/password', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('qwert123');
    expect(stored.startsWith('pbkdf2$')).toBe(true);
    expect(await verifyPassword('qwert123', stored)).toBe(true);
    expect(await verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('produces a different salt/hash each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2$abc$def')).toBe(false);
  });
});
