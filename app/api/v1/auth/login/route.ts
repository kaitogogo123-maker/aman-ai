import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRuntimeEnv } from '@/lib/config/env';
import { createMarketplaceAuthClient } from '@/lib/core/auth/marketplace-client';
import { issueLocalSessionForMarketplaceUser, setMarketplaceAuthCookies } from '@/lib/core/auth/marketplace-session';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { authErrorStatus } from '@/lib/core/auth/service';
import { setSessionCookie } from '@/lib/core/auth/cookie';
import { createRuntimeAuthEventRecorder } from '@/lib/core/auth/auth-events';
import { collectLoginContext } from '@/lib/core/admin/request-context';

const schema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const env = getRuntimeEnv();
  if (env.AUTH_PROVIDER === 'marketplace') {
    const result = await createMarketplaceAuthClient({ baseUrl: env.MARKETPLACE_API_BASE_URL }).signIn(
      parsed.data.phone,
      parsed.data.password
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: authErrorStatus(result.error) });
    }
    const local = await issueLocalSessionForMarketplaceUser(result.data.user, env);
    await recordAuthEvent(request, local.user.id, 'marketplace');
    const response = NextResponse.json({ ok: true, user: local.user });
    setSessionCookie(response, local.token);
    setMarketplaceAuthCookies(response, result.data.accessToken, result.data.refreshToken);
    return response;
  }

  const result = await createRuntimeAuthService().login(parsed.data.phone, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: authErrorStatus(result.error) });
  }

  const response = NextResponse.json({ ok: true, user: result.data.user });
  await recordAuthEvent(request, result.data.user.id, 'local');
  setSessionCookie(response, result.data.token);
  return response;
}

async function recordAuthEvent(request: NextRequest, userId: string, provider: 'local' | 'marketplace') {
  try {
    await createRuntimeAuthEventRecorder().record({
      userId,
      type: 'login',
      metadata: { provider, ...collectLoginContext(request) }
    });
  } catch {
    // Login should not fail if audit storage is temporarily unavailable.
  }
}
