import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/core/admin/session';
import { createRuntimeAccountingReport } from '@/lib/core/admin/runtime';

export async function GET(request: NextRequest) {
  if (!(await requireAdminSession(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const report = await createRuntimeAccountingReport();
  return NextResponse.json(report);
}
