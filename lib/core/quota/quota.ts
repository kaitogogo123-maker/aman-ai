export interface QuotaInput {
  used: number;
  requested: number;
  limit: number;
}

export interface QuotaResult {
  ok: boolean;
  remaining: number;
}

export function evaluateQuota(input: QuotaInput): QuotaResult {
  const used = Math.max(0, Math.trunc(input.used));
  const requested = Math.max(0, Math.trunc(input.requested));
  const limit = Math.max(0, Math.trunc(input.limit));
  const remainingBeforeRequest = Math.max(limit - used, 0);
  const ok = requested <= remainingBeforeRequest;

  return {
    ok,
    remaining: ok ? Math.max(remainingBeforeRequest - requested, 0) : remainingBeforeRequest
  };
}
