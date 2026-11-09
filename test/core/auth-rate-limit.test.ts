import { describe, expect, it } from 'vitest';
import { rateLimit, resetRateLimit } from '@/lib/core/auth/rate-limit';

describe('auth/rateLimit', () => {
  it('allows up to the limit then blocks within the window', () => {
    const key = 'unit:a';
    resetRateLimit(key);
    const now = 1000;
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(key, 3, 1000, now).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 1000, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const key = 'unit:b';
    resetRateLimit(key);
    expect(rateLimit(key, 1, 1000, 1000).ok).toBe(true);
    expect(rateLimit(key, 1, 1000, 1500).ok).toBe(false);
    expect(rateLimit(key, 1, 1000, 2001).ok).toBe(true);
  });
});
