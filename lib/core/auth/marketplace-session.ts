import type { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createRuntimeAuthStore } from './auth-store-factory';
import { signSession } from './session';
import { toPublicUser, type PublicUser, type User } from './types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MARKETPLACE_ACCESS_COOKIE = 'aman_market_access';
const MARKETPLACE_REFRESH_COOKIE = 'aman_market_refresh';

export async function issueLocalSessionForMarketplaceUser(
  marketplaceUser: PublicUser,
  runtimeEnv: AppEnv = getRuntimeEnv()
): Promise<{ user: PublicUser; token: string }> {
  const store = createRuntimeAuthStore({
    mockMode: runtimeEnv.MOCK_MODE,
    databaseUrl: runtimeEnv.DATABASE_URL
  });
  const existing =
    (await store.getUserByPhone(marketplaceUser.phone)) ??
    (await store.getUserById(localMarketplaceId(marketplaceUser)));
  const user = existing ?? (await store.createUser(toLocalUser(marketplaceUser)));
  return {
    user: toPublicUser(user),
    token: await signSession(user.id, runtimeEnv.AUTH_SECRET, SESSION_TTL_SECONDS)
  };
}

export function setMarketplaceAuthCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  const common = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  };
  response.cookies.set(MARKETPLACE_ACCESS_COOKIE, accessToken, {
    ...common,
    maxAge: 60 * 60
  });
  response.cookies.set(MARKETPLACE_REFRESH_COOKIE, refreshToken, {
    ...common,
    maxAge: SESSION_TTL_SECONDS
  });
}

// 读取 marketplace 会话 token(httpOnly,仅服务端可读)。access 1h、refresh 30d。
export function readMarketplaceTokens(request: NextRequest): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: request.cookies.get(MARKETPLACE_ACCESS_COOKIE)?.value ?? null,
    refreshToken: request.cookies.get(MARKETPLACE_REFRESH_COOKIE)?.value ?? null
  };
}

export function clearMarketplaceAuthCookies(response: NextResponse): void {
  const common = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  };
  response.cookies.set(MARKETPLACE_ACCESS_COOKIE, '', common);
  response.cookies.set(MARKETPLACE_REFRESH_COOKIE, '', common);
}

function toLocalUser(user: PublicUser): User {
  const now = new Date().toISOString();
  return {
    id: localMarketplaceId(user),
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    passwordHash: 'marketplace$external',
    balance: Number.isFinite(user.balance) ? user.balance : 0,
    createdAt: now,
    updatedAt: now
  };
}

function localMarketplaceId(user: PublicUser): string {
  const raw = user.id || user.phone;
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mkt_${safe || user.phone}`;
}
