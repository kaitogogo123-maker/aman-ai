import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRuntimeEnv } from '@/lib/config/env';
import { createMarketplaceAuthClient } from '@/lib/core/auth/marketplace-client';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { authErrorStatus } from '@/lib/core/auth/service';

const schema = z.object({
  phone: z.string().min(1),
  purpose: z.enum(['register', 'recover'])
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const env = getRuntimeEnv();
  if (env.AUTH_PROVIDER === 'marketplace') {
    const client = createMarketplaceAuthClient({ baseUrl: env.MARKETPLACE_API_BASE_URL });
    const result =
      parsed.data.purpose === 'register'
        ? await client.requestSignUpSms(parsed.data.phone)
        : await client.requestPasswordResetSms(parsed.data.phone);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: authErrorStatus(result.error) });
    }
    return NextResponse.json({ ok: true });
  }

  const result = await createRuntimeAuthService().requestOtp(parsed.data.phone, parsed.data.purpose);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: authErrorStatus(result.error) });
  }
  return NextResponse.json({ ok: true, ...result.data });
}
