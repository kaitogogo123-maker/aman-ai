import { describe, expect, it, vi } from 'vitest';
import { settlePaidPackages } from '@/lib/core/payment/purchase-service';
import { isAmanProduct, productIdForImages, imagesForProduct } from '@/lib/core/payment/packages';

const MKT = 'https://aman.kz/api';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('payment/packages', () => {
  it('maps images ↔ product id and identifies AMAN products', () => {
    expect(productIdForImages(1)).toBe(760);
    expect(productIdForImages(5)).toBe(878);
    expect(productIdForImages(6)).toBeNull();
    expect(imagesForProduct(760)).toBe(1);
    expect(imagesForProduct(878)).toBe(5);
    expect(imagesForProduct(99999)).toBeNull();
    expect(isAmanProduct(760)).toBe(true);
    expect(isAmanProduct(99999)).toBe(false);
  });
});

describe('payment/purchase-service settlePaidPackages', () => {
  it('credits paid AMAN orders by image-count (额度制), keyed by paymentId, ignoring physical/unpaid', async () => {
    // 真实 OrderDTO 结构:顶层 paymentId/statusOfOrder,商品在 items[].productId
    const fetcher = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(200, {
          content: url.includes('country=kz')
            ? [
                { paymentId: 1781592398334, statusOfOrder: 'PAID_AND_CREATED', items: [{ productId: 760 }] }, // 1 img, paid → +1 额度
                { paymentId: 1781592399999, statusOfOrder: 'WAITING_PAYMENT', items: [{ productId: 878 }] }, // unpaid → skip
                { paymentId: 1781592300000, statusOfOrder: 'PAID_AND_CREATED', items: [{ productId: 555 }] } // physical, paid → must NOT credit
              ]
            : []
        })
      )
    );
    const creditOnce = vi.fn().mockResolvedValue({ credited: true, balance: 1 });

    const result = await settlePaidPackages({ baseUrl: MKT, accessToken: 'a', userId: 'usr_1', creditOnce, fetcher });

    expect(result.creditedCount).toBe(1);
    expect(creditOnce).toHaveBeenCalledTimes(1);
    expect(creditOnce).toHaveBeenCalledWith('usr_1', 1, 'order_1781592398334', 500); // 1 张额度 + 实付 500₸ 快照
  });

  it('credits a 5-image package as 5 image-credits', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, { content: [{ paymentId: 42, statusOfOrder: 'APPROVED', items: [{ productId: 878 }] }] })
    );
    const creditOnce = vi.fn().mockResolvedValue({ credited: true, balance: 5 });
    await settlePaidPackages({ baseUrl: MKT, accessToken: 'a', userId: 'usr_2', creditOnce, fetcher });
    expect(creditOnce).toHaveBeenCalledWith('usr_2', 5, 'order_42', 1500); // 5 张额度 + 实付 1500₸ 快照(5×300)
  });

  it('returns nothing to credit when there are no paid AMAN orders', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, { content: [] }));
    const creditOnce = vi.fn();
    const result = await settlePaidPackages({ baseUrl: MKT, accessToken: 'a', userId: 'usr_1', creditOnce, fetcher });
    expect(result).toEqual({ creditedCount: 0, balance: null });
    expect(creditOnce).not.toHaveBeenCalled();
  });
});
