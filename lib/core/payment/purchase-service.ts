import { isOrderPaid } from './status';
import { imagesForProduct } from './packages';
import { priceForCount } from '@/lib/core/pricing';

// 套餐购买结算(B 模型,Mr. Li 2026-06-12 确认;商品 ID 见 packages.ts)。
// 2026-06-16 live test(真实账号 +77000000099)确认的事实:
//   - 建单 POST /internal/order/create {productIds:[pid],amount:[1],country:"kz"} → {token:"order:<paymentId>", url}
//   - /profile/orders 的 OrderDTO:顶层 paymentId 是稳定键(= token 里的数字),商品在 items[].productId;
//     orderPrice 是 marketplace 商品价(测试品才 32),不代表套餐价 → 入账按"套餐张数"折算,不按 orderPrice。
//
// 结算:回跳(?payment=success)或轮询时调。扫该用户 /profile/orders,挑出含 AMAN 套餐商品
//   (items[].productId ∈ 套餐商品)且已付的订单,按"套餐张数"加图额度(额度制),幂等入账。
// 安全:只认我们的套餐商品;creditOnce 按 order_<paymentId> 去重防重复。

interface ProfileOrder {
  paymentId?: number | null;
  statusOfOrder?: string | null;
  items?: Array<{ productId?: number | null }> | null;
}

// 取订单里第一个 AMAN 套餐商品对应的张数(无则 null)
function orderPackageImages(order: ProfileOrder): number | null {
  for (const item of order.items ?? []) {
    const images = imagesForProduct(item?.productId);
    if (images != null) return images;
  }
  return null;
}

export async function settlePaidPackages(deps: {
  baseUrl: string;
  accessToken: string;
  userId: string;
  creditOnce: (
    userId: string,
    amount: number,
    reference: string,
    amountKzt?: number | null
  ) => Promise<{ credited: boolean; balance: number } | null>;
  fetcher?: typeof fetch;
}): Promise<{ creditedCount: number; balance: number | null }> {
  const fetcher = deps.fetcher ?? fetch;
  const root = deps.baseUrl.replace(/\/+$/, '');

  const orders: ProfileOrder[] = [];
  for (const country of ['kz', 'ch'] as const) {
    // 不带 sort 参数:后端已默认按日期排序,其排序字段名不同,传 sort=createdDate 会触发 500 DB_ERROR。
    const res = await fetcher(`${root}/profile/orders?country=${country}&page=0&size=50`, {
      headers: { authorization: `Bearer ${deps.accessToken}` }
    });
    if (!res.ok) continue;
    const page = (await res.json().catch(() => null)) as { content?: ProfileOrder[] } | null;
    if (page?.content?.length) orders.push(...page.content);
  }

  let creditedCount = 0;
  let balance: number | null = null;

  for (const o of orders) {
    if (o.paymentId == null) continue;
    if (!isOrderPaid(o.statusOfOrder)) continue;
    const images = orderPackageImages(o);
    if (images == null) continue; // 非 AMAN 套餐订单(实体商品)→ 跳过,绝不入账
    // 额度制:加"张数"额度(买 N 张套餐 → +N 张)。同时把实付 ₸(=下单 customAmount=priceForCount)
    // 快照落库,供财务按真金白银对账、且日后调价不影响历史金额。
    const credited = await deps.creditOnce(deps.userId, images, `order_${o.paymentId}`, priceForCount(images));
    if (credited) {
      balance = credited.balance;
      if (credited.credited) creditedCount++;
    }
  }

  return { creditedCount, balance };
}
