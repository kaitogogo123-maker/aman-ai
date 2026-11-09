import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from '@/lib/core/auth/session';

const SECRET = 'unit-test-secret';

describe('auth/session', () => {
  it('signs and verifies, returning uid', async () => {
    const token = await signSession('usr_1', SECRET, 3600);
    const payload = await verifySession(token, SECRET);
    expect(payload?.uid).toBe('usr_1');
  });

  it('rejects a tampered token', async () => {
    const token = await signSession('usr_1', SECRET, 3600);
    expect(await verifySession(token + 'x', SECRET)).toBeNull();
    expect(await verifySession('a.b', SECRET)).toBeNull();
  });

  it('rejects wrong secret', async () => {
    const token = await signSession('usr_1', SECRET, 3600);
    expect(await verifySession(token, 'other-secret')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signSession('usr_1', SECRET, -10);
    expect(await verifySession(token, SECRET)).toBeNull();
  });
});
