import { describe, expect, it, vi } from 'vitest';
import { createPaymentService } from '@/lib/core/payment/service';

describe('payment/service', () => {
  it('returns payment URLs without crediting balance when provider is disabled', async () => {
    const creditWallet = vi.fn();
    const service = createPaymentService({
      baseUrl: 'https://tamga.example',
      provider: 'disabled',
      creditWallet
    });

    const result = await service.createTopupOrder({
      userId: 'usr_1',
      amount: 1000,
      locale: 'ru'
    });

    expect(result).toEqual({
      ok: false,
      error: 'PAYMENT_NOT_CONFIGURED',
      urls: {
        successUrl: 'https://tamga.example/ru/app?payment=success',
        failedUrl: 'https://tamga.example/ru/app?payment=failed',
        callbackUrl: 'https://tamga.example/api/v1/payments/callback'
      }
    });
    expect(creditWallet).not.toHaveBeenCalled();
  });

  it('rejects callbacks without crediting balance when provider is disabled', async () => {
    const creditWallet = vi.fn();
    const service = createPaymentService({
      baseUrl: 'https://tamga.example',
      provider: 'disabled',
      creditWallet
    });

    const result = await service.handleCallback({
      headers: new Headers(),
      body: { orderId: 'pay_1', amount: 1000, status: 'paid' }
    });

    expect(result).toEqual({
      ok: false,
      error: 'PAYMENT_NOT_CONFIGURED'
    });
    expect(creditWallet).not.toHaveBeenCalled();
  });
});
