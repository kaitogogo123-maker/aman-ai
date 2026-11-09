import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSession, setAdminSessionCookie } from '@/lib/core/admin/session';

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const session = await createAdminSession({ password: parsed.data.password });
  if (!session.ok) {
    const status = session.error === 'ADMIN_NOT_CONFIGURED' ? 503 : 401;
    return NextResponse.json({ error: session.error }, { status });
  }

  const response = NextResponse.json({ ok: true });
  setAdminSessionCookie(response, session.token);
  return response;
}
