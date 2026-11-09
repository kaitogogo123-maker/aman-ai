import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  createAdminSession,
  setAdminSessionCookie,
  verifyAdminSessionToken
} from '@/lib/core/admin/session';
import { signSession } from '@/lib/core/auth/session';

const env = {
  ADMIN_PASSWORD: 'secret-password',
  AUTH_SECRET: 'admin-session-test-secret'
};

describe('admin session helpers', () => {
  it('rejects login when ADMIN_PASSWORD is not configured', async () => {
    const result = await createAdminSession({
      password: 'secret-password',
      env: { ADMIN_PASSWORD: undefined, AUTH_SECRET: env.AUTH_SECRET }
    });

    expect(result).toEqual({ ok: false, error: 'ADMIN_NOT_CONFIGURED' });
  });

  it('rejects an incorrect admin password', async () => {
    const result = await createAdminSession({ password: 'wrong', env });

    expect(result).toEqual({ ok: false, error: 'INVALID_PASSWORD' });
  });

  it('creates a signed admin token for the configured password', async () => {
    const result = await createAdminSession({ password: 'secret-password', env });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await expect(verifyAdminSessionToken(result.token, env.AUTH_SECRET)).resolves.toBe(true);
    await expect(verifyAdminSessionToken(`${result.token}x`, env.AUTH_SECRET)).resolves.toBe(false);
  });

  it('rejects a user-style token signed with the plain AUTH_SECRET even if uid is "admin"', async () => {
    // 纵深防御:用户会话用原始 AUTH_SECRET 签名,后台用派生密钥,故普通令牌绝不会被当成管理员。
    const userToken = await signSession('admin', env.AUTH_SECRET, 3600);
    await expect(verifyAdminSessionToken(userToken, env.AUTH_SECRET)).resolves.toBe(false);
  });

  it('sets and clears the httpOnly admin cookie', async () => {
    const response = NextResponse.json({ ok: true });

    setAdminSessionCookie(response, 'token_1');
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBe('token_1');
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.httpOnly).toBe(true);

    clearAdminSessionCookie(response);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBe('');
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.maxAge).toBe(0);
  });
});

