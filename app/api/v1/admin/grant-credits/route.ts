import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/core/admin/session';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { normalizePhone } from '@/lib/core/auth/otp';

// 后台工具:给指定手机号的已注册用户赠送试用额度(张)。
// 🔴 需 admin 会话。额度=生图张数(1 张=1 额度)。作为免费赠送入账:
//    reason='free_trial' + amountKzt=null → 不计入营收(收入只认 topup/refund),
//    但会显示在后台「累计入账额度」列与流水表,留痕可查。
// 幂等:客户端每次提交带一个 idempotencyKey,creditOnce 按 grant_<key> 去重,
//    防止误触双击重复发放;有意再次赠送(换新 key)则正常叠加。
const schema = z.object({
  phone: z.string().min(1),
  count: z.coerce.number().int().min(1).max(100),
  idempotencyKey: z.string().min(1).max(200)
});

export async function POST(request: NextRequest) {
  if (!(await requireAdminSession(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const phone = normalizePhone(parsed.data.phone);
  if (phone.length < 8) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const auth = createRuntimeAuthService();
  const user = await auth.getUserByPhone(phone);
  if (!user) {
    return NextResponse.json({ error: 'NUMBER_NOT_EXIST' }, { status: 404 });
  }

  const result = await auth.creditOnce(
    user.id,
    parsed.data.count,
    `grant_${parsed.data.idempotencyKey}`,
    'free_trial',
    null
  );
  if (!result) {
    return NextResponse.json({ error: 'SERVER_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credited: result.credited, balance: result.balance });
}
