import { describe, expect, it } from 'vitest';
import { perImagePrice, priceForCount, PRICING_TIERS } from '@/lib/core/pricing';

describe('priceForCount', () => {
  it('charges 500/image up to 4, 300/image from 5', () => {
    expect(priceForCount(1)).toBe(500);
    expect(priceForCount(4)).toBe(2000);
    expect(priceForCount(5)).toBe(1500); // 超值:5 张比 4 张便宜
    expect(priceForCount(6)).toBe(1800);
    expect(priceForCount(12)).toBe(3600);
    expect(priceForCount(0)).toBe(0);
  });

  it('exposes a 5+ per-image display tier', () => {
    const plus = PRICING_TIERS.find((t) => t.plus);
    expect(plus).toBeDefined();
    expect(plus?.price).toBe(300);
  });
});

describe('perImagePrice (volume-based, cross-language discount)', () => {
  it('uses 300 once the WHOLE-order total reaches 5', () => {
    expect(perImagePrice(4)).toBe(500);
    expect(perImagePrice(5)).toBe(300);
    expect(perImagePrice(12)).toBe(300);
  });

  // 多语言:每语言一个请求各扣 perImagePrice(整单总产出)*本批张数,N 个相加 == priceForCount(整单总产出)
  it('sum of per-language requests equals priceForCount(total) — discount pools across languages', () => {
    for (const [types, langs] of [[3, 2], [3, 4], [2, 3], [4, 2], [5, 2], [3, 1]]) {
      const total = types * langs;
      const perRequest = perImagePrice(total) * types;
      const sumAcrossLanguages = perRequest * langs;
      expect(Number.isInteger(perRequest)).toBe(true);
      expect(sumAcrossLanguages).toBe(priceForCount(total));
    }
  });
});
