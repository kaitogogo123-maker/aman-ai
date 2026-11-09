import { describe, expect, it } from 'vitest';
import {
  createAccountingReport,
  formatLedgerCsv,
  formatLoginsCsv,
  formatUsersCsv,
  type AccountingUser
} from '@/lib/core/admin/accounting';
import type { QueryClient } from '@/lib/core/generation/postgres-task-store';

function fakeClient(): QueryClient {
  return {
    async query<T>(text: string): Promise<T[]> {
      if (text.includes('accounting:users')) {
        return [
          {
            id: 'usr_1',
            phone: '77000000001',
            first_name: 'Aida',
            last_name: 'K',
            email: 'a@example.com',
            balance: 2,
            created_at: '2026-07-01T00:00:00.000Z',
            credited: 4,
            spent: 2,
            login_count: 2,
            last_login: '2026-07-06T10:00:00.000Z',
            last_login_meta: { city: 'Almaty', country: 'KZ', ip: '203.0.113.7', os: 'iOS', browser: 'Safari' }
          },
          {
            id: 'usr_2',
            phone: '77000000002',
            first_name: 'Bek',
            last_name: 'T',
            email: 'b@example.com',
            balance: 0,
            created_at: '2026-07-02T00:00:00.000Z',
            credited: 1,
            spent: 1,
            login_count: 0,
            last_login: null,
            last_login_meta: null
          }
        ] as T[];
      }
      if (text.includes('accounting:logins')) {
        return [
          {
            id: 'evt_1',
            user_id: 'usr_1',
            phone: '77000000001',
            first_name: 'Aida',
            last_name: 'K',
            type: 'login',
            created_at: '2026-07-06T10:00:00.000Z',
            metadata: {
              provider: 'marketplace',
              ip: '203.0.113.7',
              country: 'KZ',
              city: 'Almaty',
              isp: 'Kcell',
              os: 'iOS',
              browser: 'Safari',
              device: 'Mobile'
            }
          }
        ] as T[];
      }
      if (text.includes('accounting:summary')) {
        return [{ credits: 5, spent: 3 }] as T[];
      }
      if (text.includes('accounting:money')) {
        return [
          { user_id: 'usr_1', reason: 'topup', delta: 4, amount_kzt: 2000 }, // 落库实付 ₸(优先用)
          { user_id: 'usr_1', reason: 'refund', delta: 1, amount_kzt: null } // 老行无 → 回退 priceForCount(1)=500₸
        ] as T[];
      }
      if (text.includes('accounting:ledger')) {
        return [
          {
            id: 'led_1',
            user_id: 'usr_1',
            phone: '77000000001',
            first_name: 'Aida',
            last_name: 'K',
            delta: 4,
            reason: 'topup',
            balance_after: 4,
            created_at: '2026-07-03T00:00:00.000Z'
          }
        ] as T[];
      }
      return [] as T[];
    }
  };
}

describe('createAccountingReport', () => {
  it('aggregates users, ledger totals, login count, and summary totals', async () => {
    const report = await createAccountingReport({ client: fakeClient(), fal: async () => null });
    expect(report.summary.totalUsers).toBe(2);
    expect(report.summary.totalCredits).toBe(5);
    expect(report.summary.totalSpent).toBe(3);
    expect(report.summary.totalBalance).toBe(2);
    expect(report.summary.falCredits).toBeNull();
    // 真实 ₸:priceForCount(4)=2000 收入,priceForCount(1)=500 退款
    expect(report.summary.totalRevenueKzt).toBe(2000);
    expect(report.summary.totalRefundKzt).toBe(500);
    expect(report.users[0]).toMatchObject({ phone: '77000000001', loginCount: 2, paidKzt: 2000, refundedKzt: 500 });
    // 付费流水行带真实 ₸ 金额(张数与钱分开)
    expect(report.ledger[0]).toMatchObject({ reason: 'topup', delta: 4, amountKzt: 2000 });
  });

  it('extracts last-login geo/device onto users and returns login detail rows', async () => {
    const report = await createAccountingReport({ client: fakeClient(), fal: async () => null });
    expect(report.users[0]).toMatchObject({
      lastLoginCity: 'Almaty',
      lastLoginCountry: 'KZ',
      lastLoginIp: '203.0.113.7',
      lastLoginDevice: 'iOS · Safari'
    });
    // 没有登录记录的用户地理/设备为 null
    expect(report.users[1].lastLoginCity).toBeNull();
    expect(report.users[1].lastLoginDevice).toBeNull();

    expect(report.logins).toHaveLength(1);
    expect(report.logins[0]).toMatchObject({
      type: 'login',
      provider: 'marketplace',
      ip: '203.0.113.7',
      city: 'Almaty',
      country: 'KZ',
      isp: 'Kcell',
      os: 'iOS',
      browser: 'Safari',
      device: 'Mobile'
    });
  });

  it('surfaces fal.ai balance when available', async () => {
    const report = await createAccountingReport({
      client: fakeClient(),
      fal: async () => ({ credits: 42.5 })
    });
    expect(report.summary.falCredits).toBe(42.5);
  });

  it('returns empty data instead of crashing when a table does not exist', async () => {
    const missing: QueryClient = {
      async query() {
        throw Object.assign(new Error('relation "auth_users" does not exist'), { code: '42P01' });
      }
    };
    const report = await createAccountingReport({ client: missing, fal: async () => null });
    expect(report.users).toEqual([]);
    expect(report.ledger).toEqual([]);
    expect(report.summary.totalUsers).toBe(0);
  });
});

describe('CSV formatting', () => {
  it('formats ledger rows as CSV with escaped values', () => {
    const csv = formatLedgerCsv([
      {
        id: 'led_1',
        userId: 'usr_1',
        phone: '7700',
        firstName: 'A, B',
        lastName: '',
        delta: 1,
        reason: 'topup',
        balanceAfter: 1,
        amountKzt: 500,
        createdAt: '2026-07-03T00:00:00.000Z'
      }
    ]);
    expect(csv).toContain('"A, B"');
    expect(csv.split('\n')[0]).toContain('reason');
  });

  it('neutralizes Excel formula injection in text fields but keeps negative numbers intact', () => {
    const csv = formatLedgerCsv([
      {
        id: 'led_1',
        userId: 'usr_1',
        phone: '+77001234567',
        firstName: '=SUM(A1:A9)',
        lastName: '',
        delta: -5,
        reason: 'generation',
        balanceAfter: 3,
        amountKzt: null,
        createdAt: '2026-07-03T00:00:00.000Z'
      }
    ]);
    const dataRow = csv.split('\n')[1];
    // 公式前缀被中和(带引号是因为值含前导单引号后仍是普通文本,含 = 会被引号包裹)
    expect(csv).toContain("'=SUM(A1:A9)");
    expect(csv).toContain("'+77001234567");
    // 负数金额原样保留,不能变成文本 '-5
    expect(dataRow).toContain(',-5,');
  });

  it('formats users rows as CSV', () => {
    const users: AccountingUser[] = [
      {
        id: 'usr_1',
        phone: '7700',
        firstName: 'Aida',
        lastName: 'K',
        email: 'a@example.com',
        balance: 2,
        createdAt: '2026-07-01T00:00:00.000Z',
        credited: 4,
        spent: 2,
        paidKzt: 2000,
        refundedKzt: 0,
        loginCount: 2,
        lastLogin: '2026-07-06T10:00:00.000Z',
        lastLoginCity: 'Almaty',
        lastLoginCountry: 'KZ',
        lastLoginIp: '203.0.113.7',
        lastLoginDevice: 'iOS · Safari',
        lastLoginLang: 'ru'
      }
    ];
    const csv = formatUsersCsv(users);
    expect(csv.split('\n')[0]).toContain('phone');
    expect(csv).toContain('a@example.com');
  });

  it('formats login activity rows as CSV', () => {
    const csv = formatLoginsCsv([
      {
        id: 'evt_1',
        userId: 'usr_1',
        phone: '77000000001',
        firstName: 'Aida',
        lastName: 'K',
        type: 'login',
        provider: 'marketplace',
        createdAt: '2026-07-06T10:00:00.000Z',
        ip: '203.0.113.7',
        country: 'KZ',
        city: 'Almaty',
        region: 'Almaty',
        timezone: 'Asia/Almaty',
        isp: 'Kcell',
        os: 'iOS',
        browser: 'Safari',
        device: 'Mobile',
        lang: 'ru'
      }
    ]);
    expect(csv.split('\n')[0]).toContain('ip');
    expect(csv).toContain('203.0.113.7');
    expect(csv).toContain('Almaty');
  });
});
