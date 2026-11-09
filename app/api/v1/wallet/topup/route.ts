import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRuntimeEnv } from '@/lib/config/env';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';

// mock 充值:直接给余额加 ₸。阶段 3 接真实支付(centercredit/Kaspi)后,
// 改为「下单→跳支付→回调验签→入账」,此接口仅保留给支付回调或测试。
const schema = z.object({ amount: z.coerce.number().int().positive().max(1_000_000) });

export async function POST(request: NextRequest) {
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!getRuntimeEnv().MOCK_MODE) {
    return NextResponse.json({ error: 'PAYMENT_NOT_CONFIGURED' }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const result = await createRuntimeAuthService().topup(uid, parsed.data.amount);
  if (!result) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...result });
}
