import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUid: vi.fn(),
  readMarketplaceTokens: vi.fn(),
  createPackageOrder: vi.fn()
}));

vi.mock('@/lib/core/auth/cookie', () => ({ getSessionUid: mocks.getSessionUid }));
vi.mock('@/lib/core/auth/marketplace-session', () => ({
  readMarketplaceTokens: mocks.readMarketplaceTokens,
  setMarketplaceAuthCookies: vi.fn()
}));
vi.mock('@/lib/core/payment/marketplace-payment', () => ({ createPackageOrder: mocks.createPackageOrder }));

import { POST as createPaymentOrder } from '@/app/api/v1/payments/orders/route';
import { POST as handlePaymentCallback } from '@/app/api/v1/payments/callback/route';

const originalPaymentProvider = process.env.PAYMENT_PROVIDER;

function ordersRequest(body: unknown) {
  return new Request('https://tamga.example/api/v1/payments/orders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  }) as never;
}

describe('payment orders route (package purchase)', () => {
  beforeEach(() => {
    mocks.getSessionUid.mockReset();
    mocks.readMarketplaceTokens.mockReset();
    mocks.createPackageOrder.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('requires login', async () => {
    mocks.getSessionUid.mockResolvedValue(null);
    const res = await createPaymentOrder(ordersRequest({ images: 1 }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'UNAUTHORIZED' });
  });

  it('rejects invalid package size', async () => {
    mocks.getSessionUid.mockResolvedValue('usr_1');
    mocks.readMarketplaceTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    const res = await createPaymentOrder(ordersRequest({ images: 9 }));
    expect(res.status).toBe(400);
  });

  it('401 when there is no marketplace session', async () => {
    mocks.getSessionUid.mockResolvedValue('usr_1');
    mocks.readMarketplaceTokens.mockReturnValue({ accessToken: null, refreshToken: null });
    const res = await createPaymentOrder(ordersRequest({ images: 1 }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'NO_MARKETPLACE_SESSION' });
  });

  it('creates the package order and returns the payment url', async () => {
    mocks.getSessionUid.mockResolvedValue('usr_1');
    mocks.readMarketplaceTokens.mockReturnValue({ accessToken: 'a', refreshToken: 'r' });
    mocks.createPackageOrder.mockResolvedValue({ ok: true, url: 'https://pay.kz/x', token: 'order:123' });
    const res = await createPaymentOrder(ordersRequest({ images: 1 }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: 'https://pay.kz/x' });
    // productIdForImages(1) === 760;带精确金额(1张=500)+ 回跳 tamga 本站 URL
    expect(mocks.createPackageOrder).toHaveBeenCalledWith(
      expect.any(String),
      'a',
      760,
      expect.objectContaining({
        customAmount: 500,
        redirectSuccessUrl: 'https://tamga.example/ru/app?payment=success',
        redirectFailUrl: 'https://tamga.example/ru/app?payment=failed'
      })
    );
  });

  it('returns 502 when order creation fails', async () => {
    mocks.getSessionUid.mockResolvedValue('usr_1');
    mocks.readMarketplaceTokens.mockReturnValue({ accessToken: 'a', refreshToken: null });
    mocks.createPackageOrder.mockResolvedValue({ ok: false, status: 500 });
    const res = await createPaymentOrder(ordersRequest({ images: 2 }));
    expect(res.status).toBe(502);
  });
});

describe('payment callback route (still stubbed, poll model is used instead)', () => {
  beforeEach(() => {
    process.env.PAYMENT_PROVIDER = 'disabled';
  });
  afterEach(() => {
    if (originalPaymentProvider === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = originalPaymentProvider;
  });

  it('rejects callbacks while provider verification is not configured', async () => {
    const res = await handlePaymentCallback(
      new Request('https://tamga.example/api/v1/payments/callback', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'pay_1', amount: 1000, status: 'paid' }),
        headers: { 'content-type': 'application/json' }
      }) as never
    );
    await expect(res.json()).resolves.toEqual({ error: 'PAYMENT_NOT_CONFIGURED' });
    expect(res.status).toBe(503);
  });
});
