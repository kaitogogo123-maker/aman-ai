import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/core/admin/session';
import { createRuntimeAccountingReport } from '@/lib/core/admin/runtime';
import { formatLedgerCsv, formatLoginsCsv, formatUsersCsv } from '@/lib/core/admin/accounting';

const EXPORT_TYPES = ['users', 'ledger', 'logins'] as const;
type ExportType = (typeof EXPORT_TYPES)[number];

export async function GET(request: NextRequest) {
  if (!(await requireAdminSession(request))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get('type');
  const type: ExportType = EXPORT_TYPES.includes(raw as ExportType) ? (raw as ExportType) : 'users';
  // 只取本次导出所需数据集(避免为一个 CSV 拉全部三张表拖慢/看似卡死);对账须全量,不设页面上限。
  const report = await createRuntimeAccountingReport(undefined, {
    ledgerLimit: 1_000_000,
    loginLimit: 1_000_000,
    sections: [type]
  });
  const csv =
    type === 'ledger'
      ? formatLedgerCsv(report.ledger)
      : type === 'logins'
        ? formatLoginsCsv(report.logins)
        : formatUsersCsv(report.users);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${type}.csv"`,
      'cache-control': 'no-store'
    }
  });
}
