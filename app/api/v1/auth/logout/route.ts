import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/core/auth/cookie';
import { clearMarketplaceAuthCookies } from '@/lib/core/auth/marketplace-session';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  clearMarketplaceAuthCookies(response);
  return response;
}
