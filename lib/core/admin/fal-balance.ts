import type { FalBalanceFetcher } from './accounting';

// fal.ai Platform API 账户额度。服务端用 FAL_KEY 调用,绝不下发密钥到前端。
// 官方端点(需 Admin API key):GET /v1/account/billing?expand=credits
//   → { username, credits: { current_balance: number, currency: "USD" } }
// 拉取失败/未配置/无权限一律返回 null,内部后台照常展示其余数据。
const FAL_BILLING_URL = 'https://api.fal.ai/v1/account/billing?expand=credits';

export function createFalBalanceFetcher(
  falKey: string | undefined,
  fetchImpl: typeof fetch = fetch
): FalBalanceFetcher {
  return async () => {
    const key = falKey?.trim();
    if (!key) return null;
    try {
      // 加超时:fal 是外部接口,慢/挂时不能拖垮整个后台加载(余额拿不到就降级 null)。
      const res = await fetchImpl(FAL_BILLING_URL, {
        headers: { Authorization: `Key ${key}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const body = await res.json();
      const credits = extractCredits(body);
      return credits === null ? null : { credits };
    } catch {
      return null;
    }
  };
}

// 主形态 credits.current_balance;仍宽容兼容裸数字 / {balance} / {credits} 以防接口微调。
function extractCredits(body: unknown): number | null {
  if (typeof body === 'number' && Number.isFinite(body)) return body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const credits = obj.credits as Record<string, unknown> | number | undefined;
    const candidate =
      (credits && typeof credits === 'object' ? credits.current_balance : credits) ??
      obj.current_balance ??
      obj.balance;
    const n = Number(candidate);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
