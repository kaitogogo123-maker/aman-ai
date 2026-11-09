import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createNeonQueryClient } from '@/lib/core/db/neon-client';
import { createAccountingReport, type AccountingReport, type ReportSection } from './accounting';
import { createFalBalanceFetcher } from './fal-balance';

// 运行时装配:只读 Neon 客户端。mock 模式或无 DATABASE_URL 时返回空报表。
// 🔴 fal 余额已解耦到独立端点(见 fetchRuntimeFalBalance):fal 是外部接口 ~3s,
//    若混在本报表里会拖慢整个后台加载。这里始终不查 fal(summary.falCredits=null),
//    页面先秒出表格,余额卡片再单独异步补上。
// ledgerLimit 缺省用于页面展示;CSV 导出传大值以免对账数据被静默截断。
export async function createRuntimeAccountingReport(
  env: AppEnv = getRuntimeEnv(),
  opts: { ledgerLimit?: number; loginLimit?: number; sections?: ReportSection[] } = {}
): Promise<AccountingReport> {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (env.MOCK_MODE || !databaseUrl) {
    return {
      summary: {
        totalUsers: 0,
        totalRevenueKzt: 0,
        totalRefundKzt: 0,
        falCredits: null,
        totalBalance: 0,
        totalCredits: 0,
        totalSpent: 0
      },
      users: [],
      ledger: [],
      logins: []
    };
  }

  return createAccountingReport({
    client: createNeonQueryClient(databaseUrl),
    fal: async () => null, // fal 不在主报表里查,避免外部接口拖慢
    ledgerLimit: opts.ledgerLimit,
    loginLimit: opts.loginLimit,
    sections: opts.sections
  });
}

// fal.ai 账户余额(USD),独立于主报表异步拉取。Admin key 优先(billing 端点要求)。
export async function fetchRuntimeFalBalance(env: AppEnv = getRuntimeEnv()): Promise<number | null> {
  const fetcher = createFalBalanceFetcher(env.FAL_ADMIN_KEY ?? env.FAL_KEY);
  const result = await fetcher().catch(() => null);
  return result ? Number(result.credits) : null;
}
