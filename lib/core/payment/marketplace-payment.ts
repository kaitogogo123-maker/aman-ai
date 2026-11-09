import { findOrderStatus } from './status';

// marketplace 支付编排。契约见 docs/aman-payment-api-integration-guide.md:
// - 发起支付 POST /payments(BCC 网关),头 Idempotency-Key + Content-Type,无 Authorization;
//   body snake_case { order_ids, amount, currency:398, description:"AMAN AI", client_ip_address };
//   200 返回 { token, url } —— 必须把 url 给用户跳转付款;409 = 同 key 初始化中需重试。
// - 支付状态走轮询 GET /profile/orders 读 statusOfOrder(无 webhook),PAID_AND_CREATED = 已付。
// 仍未定:充值如何建成订单拿到 order_ids(无实体商品,产品/业务题)。

export interface CreatePaymentResult {
  token: string;
  url: string;
}

export class PaymentInitializingError extends Error {
  constructor() {
    super('payment is initializing for this idempotency key, retry later');
    this.name = 'PaymentInitializingError';
  }
}

// 发起支付:对已存在订单(order_ids)发起一笔支付,拿银行支付页 url + 支付 token。
// idempotencyKey 由调用方生成(UUID v4),重试同一笔须复用同 key 防重复扣款。
export async function createPayment(
  baseUrl: string,
  params: { orderIds: number[]; amount: number; clientIp: string },
  options: { idempotencyKey: string; path?: string; fetcher?: typeof fetch }
): Promise<CreatePaymentResult> {
  const root = baseUrl.replace(/\/+$/, '');
  const path = options.path ?? '/payments';
  const fetcher = options.fetcher ?? fetch;
  const res = await fetcher(`${root}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': options.idempotencyKey },
    body: JSON.stringify({
      order_ids: params.orderIds,
      amount: Math.trunc(params.amount), // 整数坚戈,不带 tiyn
      currency: 398,
      description: 'AMAN AI',
      client_ip_address: params.clientIp
    })
  });
  if (res.status === 409) throw new PaymentInitializingError();
  if (!res.ok) throw new Error(`create-payment failed: ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as { token?: string; url?: string };
  if (!data.token || !data.url) throw new Error('create-payment response missing token/url');
  return { token: data.token, url: data.url };
}

export type CreatePackageOrderResult =
  | { ok: true; url: string; token: string }
  | { ok: false; status: number };

export interface PackageOrderOptions {
  // 精确收费金额(₸):覆盖商品配置价,把价格绑到生图而非商品(后端 2026-06-24 新增字段)。
  customAmount: number;
  // 付款后银行回跳地址:必须指回 tamga,否则用户落在 AMAN 页(后端新增字段)。
  redirectSuccessUrl: string;
  redirectFailUrl: string;
}

// 建套餐订单:POST /internal/order/create,Bearer marketplace token。
// body { productIds:[pid], amount:[1], country:"kz", customAmount, redirectSuccessUrl, redirectFailUrl }
// → 200 { token:"order:<paymentId>", url }。url 是银行支付页;401 → 调用方刷新 token 重试。
export async function createPackageOrder(
  marketplaceBaseUrl: string,
  accessToken: string,
  productId: number,
  options: PackageOrderOptions,
  fetcher: typeof fetch = fetch
): Promise<CreatePackageOrderResult> {
  const root = marketplaceBaseUrl.replace(/\/+$/, '');
  const res = await fetcher(`${root}/internal/order/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      productIds: [productId],
      amount: [1],
      country: 'kz',
      customAmount: options.customAmount,
      redirectSuccessUrl: options.redirectSuccessUrl,
      redirectFailUrl: options.redirectFailUrl
    })
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json().catch(() => ({}))) as { token?: string; url?: string };
  if (!data.token || !data.url) return { ok: false, status: 502 };
  return { ok: true, url: data.url, token: data.token };
}

export type VerifyCreditResult =
  | { ok: true; credited: boolean; balance: number }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_PAID' | 'NO_PRICE' | 'USER_NOT_FOUND'; status?: string | null };

// 查某订单是否已付(轮询 /profile/orders),已付则按订单金额幂等入账(creditOnce 注入,按 order_<id> 去重)。
// 安全约束:仅应对「我们自己创建的充值订单」调用,不能拿任意已付的实体商品订单来刷余额。
export async function verifyAndCreditOrder(params: {
  baseUrl: string;
  accessToken: string;
  orderId: number;
  userId: string;
  creditOnce: (userId: string, amount: number, reference: string) => Promise<{ credited: boolean; balance: number } | null>;
  fetcher?: typeof fetch;
}): Promise<VerifyCreditResult> {
  const status = await findOrderStatus(params.baseUrl, params.accessToken, params.orderId, params.fetcher);
  if (!status.found) return { ok: false, reason: 'NOT_FOUND' };
  if (!status.paid) return { ok: false, reason: 'NOT_PAID', status: status.statusOfOrder };
  if (status.orderPrice === null) return { ok: false, reason: 'NO_PRICE' };

  const credited = await params.creditOnce(params.userId, status.orderPrice, `order_${params.orderId}`);
  if (!credited) return { ok: false, reason: 'USER_NOT_FOUND' };
  return { ok: true, credited: credited.credited, balance: credited.balance };
}
