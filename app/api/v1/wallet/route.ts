import { NextRequest, NextResponse } from 'next/server';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';

export async function GET(request: NextRequest) {
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const wallet = await createRuntimeAuthService().getWallet(uid);
  if (!wallet) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json(wallet);
}
