import type { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { signSession, verifySession } from '@/lib/core/auth/session';

export const ADMIN_SESSION_COOKIE = 'aman_admin';

const ADMIN_SESSION_UID = 'admin';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;

// 纵深防御:后台令牌用从 AUTH_SECRET 派生的独立密钥签名。即便将来某认证路径让用户 uid
// 恰好等于 'admin',其令牌是用原始 AUTH_SECRET 签的,验签也过不了后台派生密钥这一关。
function adminSigningSecret(authSecret: string): string {
  return `${authSecret}::admin-session-v1`;
}

export type AdminSessionError = 'ADMIN_NOT_CONFIGURED' | 'INVALID_PASSWORD';

export async function createAdminSession({
  password,
  env = getRuntimeEnv()
}: {
  password: string;
  env?: Pick<AppEnv, 'ADMIN_PASSWORD' | 'AUTH_SECRET'>;
}): Promise<{ ok: true; token: string } | { ok: false; error: AdminSessionError }> {
  if (!env.ADMIN_PASSWORD) {
    return { ok: false, error: 'ADMIN_NOT_CONFIGURED' };
  }
  if (!timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return { ok: false, error: 'INVALID_PASSWORD' };
  }
  return {
    ok: true,
    token: await signSession(ADMIN_SESSION_UID, adminSigningSecret(env.AUTH_SECRET), ADMIN_SESSION_TTL_SECONDS)
  };
}

export async function verifyAdminSessionToken(token: string | undefined | null, authSecret = getRuntimeEnv().AUTH_SECRET): Promise<boolean> {
  if (!token) return false;
  const payload = await verifySession(token, adminSigningSecret(authSecret));
  return payload?.uid === ADMIN_SESSION_UID;
}

export async function requireAdminSession(
  request: NextRequest,
  env: Pick<AppEnv, 'AUTH_SECRET'> = getRuntimeEnv()
): Promise<boolean> {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, env.AUTH_SECRET);
}

export function setAdminSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: '/'
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/'
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

