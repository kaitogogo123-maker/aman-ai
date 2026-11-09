import { NextRequest, NextResponse } from 'next/server';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';

export async function GET(request: NextRequest) {
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ user: null });
  }
  const user = await createRuntimeAuthService().me(uid);
  return NextResponse.json({ user });
}
