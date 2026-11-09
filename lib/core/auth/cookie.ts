import type { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/config/env';
import { SESSION_COOKIE, verifySession } from './session';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/'
  });
}

// 读取并校验会话,返回 userId(无效返回 null)
export async function getSessionUid(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token, getRuntimeEnv().AUTH_SECRET);
  return payload?.uid ?? null;
}
