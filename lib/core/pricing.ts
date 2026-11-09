// Aman AI 价格表（坚戈 ₸）。来源：设计稿价格页。
// 注意：这是展示用阶梯价；真实扣费/支付逻辑等客户支付接口文档到位后再接入。
export interface PricingTier {
  count: number;
  price: number;
  best?: boolean;
  // plus 行 = 「5+ 张」展示行：price 表示每张单价（不是总价），用于价格页单独一行
  plus?: boolean;
}

// 客户最终定价（2026-06-03 确认）：
//   1–4 张按每张 500₸ 线性；5 张起每张降到 300₸（5 张 = 1500₸ 标「超值」，引导用户买够 5 张）。
// 价格页只展示 1–5 + 一行「5+ 张 300₸/张」，避免一长串档位。
const PRICE_LOW = 500; // 1–4 张单价
const PRICE_HIGH = 300; // ≥5 张单价
const HIGH_THRESHOLD = 5;

export const PRICING_TIERS: PricingTier[] = [
  { count: 1, price: 500 },
  { count: 2, price: 1000 },
  { count: 3, price: 1500 },
  { count: 4, price: 2000 },
  { count: 5, price: 1500, best: true },
  { count: HIGH_THRESHOLD, price: PRICE_HIGH, plus: true } // 5+ 张 — 300₸/张
];

// 单张单价（₸）：由"用于判定折扣的总张数"决定。≥5 张整单走 300，否则 500。
// 多语言订单按"整单总产出"传 volumeCount，让折扣跨语言合并（兑现客户"5+ 张 300/张"）。
export function perImagePrice(volumeCount: number): number {
  return volumeCount >= HIGH_THRESHOLD ? PRICE_HIGH : PRICE_LOW;
}

// 按图片张数计算总价（₸）。≤4 张每张 500；≥5 张每张 300。
export function priceForCount(count: number): number {
  if (count <= 0) return 0;
  return count * perImagePrice(count);
}
