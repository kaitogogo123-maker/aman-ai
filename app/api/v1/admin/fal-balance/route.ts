import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/core/admin/session';
import { fetchRuntimeFalBalance } from '@/lib/core/admin/runtime';

// 独立于主对账报表:fal 是外部接口 ~3s,单独异步拉取,不拖慢表格首屏。
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const credits = await fetchRuntimeFalBalance();
  return NextResponse.json({ credits });
}
