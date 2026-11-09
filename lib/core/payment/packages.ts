// AMAN AI 生图套餐 → marketplace 商品 ID(客户负责人 2026-06-13 指定,sellerId=2,测试商品)。
// 套餐购买模型:每个套餐对应一个专用商品,下单买该商品 = 买对应张数的生图额度。
// 用 productId 识别"这是不是 AMAN 套餐订单"(安全:结算入账只认这 5 个商品,绝不入账任意已付实体单)。
export const PACKAGE_PRODUCTS: Record<number, number> = {
  1: 760,
  2: 628,
  3: 753,
  4: 874,
  5: 878
};

export const AMAN_PRODUCT_IDS = new Set<number>(Object.values(PACKAGE_PRODUCTS));

// 商品 ID → 张数(结算识别用;2026-06-16 live test:/profile/orders 的 productId 在 items[].productId)
const PRODUCT_TO_IMAGES: Record<number, number> = Object.fromEntries(
  Object.entries(PACKAGE_PRODUCTS).map(([images, pid]) => [pid, Number(images)])
);

// 张数 → 商品 ID(发起购买用)
export function productIdForImages(images: number): number | null {
  return PACKAGE_PRODUCTS[images] ?? null;
}

// 商品 ID → 张数(非 AMAN 套餐返回 null)
export function imagesForProduct(productId: number | null | undefined): number | null {
  return productId != null ? PRODUCT_TO_IMAGES[productId] ?? null : null;
}

// 订单的 productId 是否属于 AMAN 套餐(结算识别用)
export function isAmanProduct(productId: number | null | undefined): boolean {
  return productId != null && AMAN_PRODUCT_IDS.has(productId);
}
