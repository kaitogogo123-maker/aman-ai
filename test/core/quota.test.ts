import { describe, expect, it } from 'vitest';
import { evaluateQuota } from '@/lib/core/quota/quota';

describe('evaluateQuota', () => {
  it('allows a request inside the daily limit', () => {
    expect(evaluateQuota({ used: 4, requested: 3, limit: 10 })).toEqual({
      ok: true,
      remaining: 3
    });
  });

  it('rejects a request that exceeds the daily limit', () => {
    expect(evaluateQuota({ used: 9, requested: 2, limit: 10 })).toEqual({
      ok: false,
      remaining: 1
    });
  });
});
