import { resolveLocale } from '@/lib/i18n';

export type PaymentProvider = 'disabled' | 'external';

export interface PaymentUrls {
  successUrl: string;
  failedUrl: string;
  callbackUrl: string;
}

export type PaymentErrorCode = 'PAYMENT_NOT_CONFIGURED' | 'PAYMENT_PROVIDER_NOT_IMPLEMENTED';

export interface CreateTopupOrderInput {
  userId: string;
  amount: number;
  locale?: string;
}

export type CreateTopupOrderResult =
  | { ok: true; orderId: string; redirectUrl: string }
  | { ok: false; error: PaymentErrorCode; urls: PaymentUrls };

export type PaymentCallbackResult = { ok: true; balance?: number } | { ok: false; error: PaymentErrorCode };

export interface PaymentCallbackInput {
  headers: Headers;
  body: unknown;
}

export interface PaymentServiceDependencies {
  baseUrl: string;
  provider: PaymentProvider;
  creditWallet: (userId: string, amount: number) => Promise<{ balance: number } | null>;
}

export function paymentErrorStatus(code: PaymentErrorCode): number {
  switch (code) {
    case 'PAYMENT_NOT_CONFIGURED':
    case 'PAYMENT_PROVIDER_NOT_IMPLEMENTED':
      return 503;
  }
}

export function createPaymentService({ baseUrl, provider, creditWallet }: PaymentServiceDependencies) {
  return {
    createTopupOrder(input: CreateTopupOrderInput): Promise<CreateTopupOrderResult> {
      void creditWallet;
      const urls = buildPaymentUrls(baseUrl, input.locale);
      if (provider === 'disabled') {
        return Promise.resolve({ ok: false, error: 'PAYMENT_NOT_CONFIGURED', urls });
      }
      return Promise.resolve({ ok: false, error: 'PAYMENT_PROVIDER_NOT_IMPLEMENTED', urls });
    },

    handleCallback(input: PaymentCallbackInput): Promise<PaymentCallbackResult> {
      void input;
      void creditWallet;
      if (provider === 'disabled') {
        return Promise.resolve({ ok: false, error: 'PAYMENT_NOT_CONFIGURED' });
      }
      return Promise.resolve({ ok: false, error: 'PAYMENT_PROVIDER_NOT_IMPLEMENTED' });
    }
  };
}

function buildPaymentUrls(baseUrl: string, locale = 'ru'): PaymentUrls {
  const origin = normalizeOrigin(baseUrl);
  const normalizedLocale = resolveLocale(locale);
  return {
    successUrl: `${origin}/${normalizedLocale}/app?payment=success`,
    failedUrl: `${origin}/${normalizedLocale}/app?payment=failed`,
    callbackUrl: `${origin}/api/v1/payments/callback`
  };
}

function normalizeOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
}
