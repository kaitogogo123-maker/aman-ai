// 轻量滑动窗口限流(纯函数 + globalThis 单例计数)。
// Cloudflare Workers 多 isolate 下为「每实例」计数,只能挡住单实例的常规滥用/误触;
//    生产级防暴力(分布式)建议叠加 Cloudflare WAF / Rate Limiting Rules / Turnstile。
export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

interface Hit {
  count: number;
  resetAt: number;
}

function store(): Map<string, Hit> {
  const g = globalThis as typeof globalThis & { __amanRateLimit?: Map<string, Hit> };
  g.__amanRateLimit ??= new Map();
  return g.__amanRateLimit;
}

// key 命中计数;同一窗口内超过 limit 即拒。now 显式传入以便测试。
export function rateLimit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const s = store();
  const hit = s.get(key);
  if (!hit || now >= hit.resetAt) {
    s.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (hit.count >= limit) {
    return { ok: false, retryAfterMs: hit.resetAt - now };
  }
  hit.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

// 测试/登出等场景清理某 key
export function resetRateLimit(key: string): void {
  store().delete(key);
}
