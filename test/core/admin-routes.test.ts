import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('@/lib/config/env', () => ({
  getRuntimeEnv: () => ({
    ADMIN_PASSWORD: 'secret',
    AUTH_SECRET: 'admin-route-secret',
    MOCK_MODE: true,
    DATABASE_URL: undefined,
    FAL_KEY: undefined
  })
}));

vi.mock('@/lib/core/admin/runtime', () => ({
  fetchRuntimeFalBalance: async () => 50.36,
  createRuntimeAccountingReport: async () => ({
    summary: {
      totalUsers: 1,
      totalRevenueKzt: 2000,
      totalRefundKzt: 0,
      falCredits: 10,
      totalBalance: 2,
      totalCredits: 4,
      totalSpent: 2
    },
    users: [
      {
        id: 'usr_1',
        phone: '77000000001',
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
        lastLoginDevice: 'iOS · Safari'
      }
    ],
    ledger: [
      {
        id: 'led_1',
        userId: 'usr_1',
        phone: '77000000001',
        firstName: 'Aida',
        lastName: 'K',
        delta: 4,
        reason: 'topup',
        balanceAfter: 4,
        amountKzt: 2000,
        createdAt: '2026-07-03T00:00:00.000Z'
      }
    ],
    logins: [
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
        device: 'Mobile'
      }
    ]
  })
}));

import { NextRequest } from 'next/server';
import { POST as loginPOST } from '@/app/api/v1/admin/login/route';
import { GET as accountingGET } from '@/app/api/v1/admin/accounting/route';
import { GET as exportGET } from '@/app/api/v1/admin/accounting/export/route';
import { GET as falGET } from '@/app/api/v1/admin/fal-balance/route';
import { POST as resetPOST } from '@/app/api/v1/admin/reset-test-account/route';
import { ADMIN_SESSION_COOKIE, createAdminSession } from '@/lib/core/admin/session';

async function authedRequest(url: string, method = 'GET'): Promise<NextRequest> {
  const session = await createAdminSession({ password: 'secret' });
  if (!session.ok) throw new Error('failed to create admin session');
  return new NextRequest(url, { method, headers: { cookie: `${ADMIN_SESSION_COOKIE}=${session.token}` } });
}

describe('admin routes', () => {
  it('rejects login with a wrong password', async () => {
    const res = await loginPOST(jsonRequest('/api/v1/admin/login', { password: 'nope' }));
    expect(res.status).toBe(401);
  });

  it('sets an admin cookie on correct password', async () => {
    const res = await loginPOST(jsonRequest('/api/v1/admin/login', { password: 'secret' }));
    expect(res.status).toBe(200);
    expect(res.cookies.get(ADMIN_SESSION_COOKIE)?.value).toBeTruthy();
  });

  it('blocks accounting JSON without an admin session', async () => {
    const res = await accountingGET(new NextRequest('https://tamga.example/api/v1/admin/accounting'));
    expect(res.status).toBe(401);
  });

  it('returns the accounting report for an authenticated admin', async () => {
    const res = await accountingGET(await authedRequest('https://tamga.example/api/v1/admin/accounting'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalUsers).toBe(1);
    expect(body.users).toHaveLength(1);
  });

  it('blocks CSV export without an admin session', async () => {
    const res = await exportGET(new NextRequest('https://tamga.example/api/v1/admin/accounting/export?type=users'));
    expect(res.status).toBe(401);
  });

  it('returns users CSV for an authenticated admin export request', async () => {
    const res = await exportGET(await authedRequest('https://tamga.example/api/v1/admin/accounting/export?type=users'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('77000000001');
  });

  it('returns ledger CSV for type=ledger', async () => {
    const res = await exportGET(await authedRequest('https://tamga.example/api/v1/admin/accounting/export?type=ledger'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('topup');
  });

  it('blocks fal-balance without an admin session', async () => {
    const res = await falGET(new NextRequest('https://tamga.example/api/v1/admin/fal-balance'));
    expect(res.status).toBe(401);
  });

  it('returns fal balance for an authenticated admin', async () => {
    const res = await falGET(await authedRequest('https://tamga.example/api/v1/admin/fal-balance'));
    expect(res.status).toBe(200);
    expect((await res.json()).credits).toBe(50.36);
  });

  it('blocks reset-test-account without an admin session', async () => {
    const res = await resetPOST(new NextRequest('https://tamga.example/api/v1/admin/reset-test-account', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('guards reset-test-account when no database is configured (mock env)', async () => {
    const res = await resetPOST(
      await authedRequest('https://tamga.example/api/v1/admin/reset-test-account', 'POST')
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('NO_DATABASE');
  });

  it('returns login activity CSV for type=logins', async () => {
    const res = await exportGET(await authedRequest('https://tamga.example/api/v1/admin/accounting/export?type=logins'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('203.0.113.7');
    expect(text).toContain('Almaty');
  });
});

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`https://tamga.example${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}
