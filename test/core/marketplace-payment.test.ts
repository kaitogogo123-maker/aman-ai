import { describe, expect, it, vi } from 'vitest';
import { createPayment, PaymentInitializingError, verifyAndCreditOrder } from '@/lib/core/payment/marketplace-payment';

const BASE = 'https://aman.kz/api';
const PAY_BASE = 'https://testbcc.amanal.kz';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('payment/marketplace-payment', () => {
  it('createPayment posts /payments with idempotency-key + snake_case body and returns {token, url}', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { token: 'tok_1', url: 'https://pay.bcc.kz/p/abc' }));
    const result = await createPayment(
      PAY_BASE,
      { orderIds: [2060, 2061], amount: 15000, clientIp: '203.0.113.5' },
      { idempotencyKey: 'idem-1', fetcher }
    );
    expect(result).toEqual({ token: 'tok_1', url: 'https://pay.bcc.kz/p/abc' });
    const [calledUrl, init] = fetcher.mock.calls[0];
    expect(calledUrl).toBe('https://testbcc.amanal.kz/payments');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({ 'idempotency-key': 'idem-1' });
    expect((init as RequestInit).headers).not.toHaveProperty('authorization');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      order_ids: [2060, 2061],
      amount: 15000,
      currency: 398,
      description: 'AMAN AI',
      client_ip_address: '203.0.113.5'
    });
  });

  it('createPayment throws PaymentInitializingError on 409', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(409, { error: 'initializing' }));
    await expect(
      createPayment(PAY_BASE, { orderIds: [1], amount: 100, clientIp: '1.1.1.1' }, { idempotencyKey: 'k', fetcher })
    ).rejects.toBeInstanceOf(PaymentInitializingError);
  });

  it('createPayment throws when response missing token/url', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { token: 'tok_only' }));
    await expect(
      createPayment(PAY_BASE, { orderIds: [1], amount: 100, clientIp: '1.1.1.1' }, { idempotencyKey: 'k', fetcher })
    ).rejects.toThrow(/missing token\/url/);
  });

  it('verifyAndCreditOrder credits by orderPrice when the order is PAID_AND_CREATED', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [{ paymentId: 555, statusOfOrder: 'PAID_AND_CREATED', orderPrice: 15000 }] })
    );
    const creditOnce = vi.fn().mockResolvedValue({ credited: true, balance: 15000 });
    const result = await verifyAndCreditOrder({ baseUrl: BASE, accessToken: 'a', orderId: 555, userId: 'usr_1', creditOnce, fetcher });
    expect(result).toEqual({ ok: true, credited: true, balance: 15000 });
    expect(creditOnce).toHaveBeenCalledWith('usr_1', 15000, 'order_555');
  });

  it('verifyAndCreditOrder also treats APPROVED as paid', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [{ paymentId: 556, statusOfOrder: 'APPROVED', orderPrice: 5000 }] })
    );
    const creditOnce = vi.fn().mockResolvedValue({ credited: true, balance: 5000 });
    const result = await verifyAndCreditOrder({ baseUrl: BASE, accessToken: 'a', orderId: 556, userId: 'usr_2', creditOnce, fetcher });
    expect(result).toEqual({ ok: true, credited: true, balance: 5000 });
    expect(creditOnce).toHaveBeenCalledWith('usr_2', 5000, 'order_556');
  });

  it('verifyAndCreditOrder does not credit an unpaid order', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [{ paymentId: 555, statusOfOrder: 'WAITING_PAYMENT', orderPrice: 15000 }] })
    );
    const creditOnce = vi.fn();
    const result = await verifyAndCreditOrder({ baseUrl: BASE, accessToken: 'a', orderId: 555, userId: 'usr_1', creditOnce, fetcher });
    expect(result).toEqual({ ok: false, reason: 'NOT_PAID', status: 'WAITING_PAYMENT' });
    expect(creditOnce).not.toHaveBeenCalled();
  });

  it('verifyAndCreditOrder reports NOT_FOUND when the order is absent', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { content: [] }));
    const creditOnce = vi.fn();
    const result = await verifyAndCreditOrder({ baseUrl: BASE, accessToken: 'a', orderId: 999, userId: 'usr_1', creditOnce, fetcher });
    expect(result).toEqual({ ok: false, reason: 'NOT_FOUND' });
    expect(creditOnce).not.toHaveBeenCalled();
  });
});
