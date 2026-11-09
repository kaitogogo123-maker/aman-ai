// 支付状态:走轮询 GET /profile/orders 读 statusOfOrder(对方不发 webhook)。
// 完整枚举(客户研发 2026-06-12):
//   IN_PROGRESS/NEW/PENDING = 等待支付;APPROVED / PAID_AND_CREATED = 支付成功确认;
//   DECLINED = 被拒;EXPIRED = 过期归档。
export const PAID_ORDER_STATUSES = ['APPROVED', 'PAID_AND_CREATED'] as const;
export const FAILED_ORDER_STATUSES = ['DECLINED', 'EXPIRED'] as const;

// 已支付成功(两种状态都算)
export function isOrderPaid(statusOfOrder: string | null | undefined): boolean {
  return statusOfOrder != null && (PAID_ORDER_STATUSES as readonly string[]).includes(statusOfOrder);
}

// 终态失败(被拒/过期):轮询遇到可停止,不必再等
export function isOrderFinalFailed(statusOfOrder: string | null | undefined): boolean {
  return statusOfOrder != null && (FAILED_ORDER_STATUSES as readonly string[]).includes(statusOfOrder);
}

export interface OrderStatusResult {
  found: boolean;
  statusOfOrder: string | null;
  orderPrice: number | null;
  paid: boolean;
}

interface ProfileOrder {
  // 订单稳定数字键是 paymentId(顶层无 id 字段,只有 paymentId / orderNumber)。
  paymentId?: number | null;
  statusOfOrder?: string | null;
  orderPrice?: number | null;
}

// 在 /profile/orders 里按 orderId 找订单并读其状态/金额。marketplace 用 Bearer 鉴权,
// 订单可能落在 kz 或 ch,两边都扫(刚下单的充值订单一般在 page 0)。
export async function findOrderStatus(
  baseUrl: string,
  accessToken: string,
  orderId: number,
  fetcher: typeof fetch = fetch
): Promise<OrderStatusResult> {
  const root = baseUrl.replace(/\/+$/, '');
  for (const country of ['kz', 'ch'] as const) {
    // 不带 sort 参数:后端已默认按日期排序,其排序字段名不同,传 sort=createdDate 会触发 500 DB_ERROR。
    const res = await fetcher(`${root}/profile/orders?country=${country}&page=0&size=50`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) continue;
    const page = (await res.json().catch(() => null)) as { content?: ProfileOrder[] } | null;
    const order = page?.content?.find((o) => o.paymentId === orderId);
    if (order) {
      const statusOfOrder = order.statusOfOrder ?? null;
      return {
        found: true,
        statusOfOrder,
        orderPrice: typeof order.orderPrice === 'number' ? order.orderPrice : null,
        paid: isOrderPaid(statusOfOrder)
      };
    }
  }
  return { found: false, statusOfOrder: null, orderPrice: null, paid: false };
}
