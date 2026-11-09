import { describe, expect, it } from 'vitest';
import { isPaymentWhitelisted } from '@/lib/core/payment/free-access';

describe('isPaymentWhitelisted', () => {
  it('matches the demo account regardless of phone formatting', () => {
    expect(isPaymentWhitelisted('77000000099')).toBe(true);
    expect(isPaymentWhitelisted('+7 708 611 0912')).toBe(true);
  });

  it('rejects non-whitelisted or empty phones', () => {
    expect(isPaymentWhitelisted('77001234567')).toBe(false);
    expect(isPaymentWhitelisted(null)).toBe(false);
    expect(isPaymentWhitelisted(undefined)).toBe(false);
  });
});
