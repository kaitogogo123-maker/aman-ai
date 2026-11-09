import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/core/admin/session';
import { getRuntimeEnv } from '@/lib/config/env';
import { createNeonQueryClient } from '@/lib/core/db/neon-client';
import { getFreeAccessPhones } from '@/lib/core/payment/free-access';

// 维护工具:规整测试/演示账号 —— 清空额度流水 + 余额归零 + 名字统一标注为 "Whitelist"(便于在后台一眼识别)。
// 🔴 安全:仅能作用于免支付白名单(测试号),硬编码范围,绝不能碰真实用户;需 admin 会话。
// 测试/演示号(当前仅 sha sha)统一标注:保留原名 + 白名单标记,后台一眼识别。
const WHITELIST_LABEL = 'Sha Sha (Whitelist)';
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const dbUrl = getRuntimeEnv().DATABASE_URL?.trim();
  if (!dbUrl) return NextResponse.json({ error: 'NO_DATABASE' }, { status: 400 });

  const phones = getFreeAccessPhones();
  if (!phones.length) return NextResponse.json({ resetPhones: [], deletedLedgerRows: 0 });

  const client = createNeonQueryClient(dbUrl);
  const phPlaceholders = phones.map((_, i) => `$${i + 1}`).join(',');
  const users = await client.query<{ id: string; phone: string }>(
    `select id, phone from auth_users where phone in (${phPlaceholders})`,
    phones
  );
  if (!users.length) return NextResponse.json({ resetPhones: [], deletedLedgerRows: 0 });

  const ids = users.map((u) => u.id);
  const idPlaceholders = ids.map((_, i) => `$${i + 1}`).join(',');
  // 删额度流水(test_grant / migrate / generation 等测试记录)
  const deleted = await client.query<{ id: string }>(
    `delete from credit_ledger where user_id in (${idPlaceholders}) returning id`,
    ids
  );
  // 余额归零(生成对该测试号免费,不影响演示使用)+ 名字标注为 Whitelist(仅创建时同步,登录不覆盖,故会保留)
  const n = ids.length;
  await client.query(
    `update auth_users set balance = 0, first_name = $${n + 1}, last_name = $${n + 2}, updated_at = $${n + 3} where id in (${idPlaceholders})`,
    [...ids, WHITELIST_LABEL, '', new Date().toISOString()]
  );

  return NextResponse.json({
    resetPhones: users.map((u) => u.phone),
    deletedLedgerRows: deleted.length,
    renamedTo: WHITELIST_LABEL
  });
}
