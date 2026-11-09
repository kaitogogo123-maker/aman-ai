import { describe, expect, it, vi } from 'vitest';
import { fetchSessionLoginFlag, readCachedLoginFlag, syncCachedLoginFlag } from '@/lib/core/auth/client-auth-state';

describe('client auth state helpers', () => {
  it('treats an existing /me user as logged in even when the cached flag is missing', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ user: { phone: '77009050988' } }));

    await expect(fetchSessionLoginFlag(fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/auth/me');
  });

  it('clears a stale cached login flag when /me has no user', async () => {
    const storage = new Map<string, string>([['aman_auth', '1']]);

    expect(readCachedLoginFlag(storageAdapter(storage))).toBe(true);
    syncCachedLoginFlag(storageAdapter(storage), false);

    expect(storage.has('aman_auth')).toBe(false);
  });
});

function storageAdapter(storage: Map<string, string>) {
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  };
}
