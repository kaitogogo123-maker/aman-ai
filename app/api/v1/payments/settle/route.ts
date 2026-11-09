import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/config/env';
import { getSessionUid } from '@/lib/core/auth/cookie';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { createMarketplaceAuthClient } from '@/lib/core/auth/marketplace-client';
import { readMarketplaceTokens, setMarketplaceAuthCookies } from '@/lib/core/auth/marketplace-session';
import { settlePaidPackages } from '@/lib/core/payment/purchase-service';

// 结算:支付完成回跳(?payment=success)后、以及每次应用加载时由前端调用。
// 扫该用户已付的 AMAN 套餐订单,按张数幂等入账(creditOnce 按 order_<paymentId> 去重,可安全重复调用)。
export async function POST(request: NextRequest) {
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const auth = createRuntimeAuthService();
  const env = getRuntimeEnv();
  const { accessToken, refreshToken } = readMarketplaceTokens(request);

  // access cookie 寿命=token=1h,回头客常是 access 已失效但 refresh(30天)还在 → 先刷新,否则结算不到。
  let token = accessToken;
  let rotated: { accessToken: string; refreshToken: string } | null = null;
  if (!token && refreshToken) {
    const refreshed = await createMarketplaceAuthClient({ baseUrl: env.MARKETPLACE_API_BASE_URL }).refresh(refreshToken);
    if (refreshed.ok) {
      token = refreshed.data.accessToken;
      rotated = refreshed.data;
    }
  }

  if (!token) {
    const wallet = await auth.getWallet(uid);
    return NextResponse.json({ creditedCount: 0, balance: wallet?.balance ?? 0 });
  }

  const result = await settlePaidPackages({
    baseUrl: env.MARKETPLACE_API_BASE_URL,
    accessToken: token,
    userId: uid,
    creditOnce: (userId, amount, reference, amountKzt) =>
      auth.creditOnce(userId, amount, reference, 'topup', amountKzt)
  });

  const wallet = await auth.getWallet(uid);
  const response = NextResponse.json({
    creditedCount: result.creditedCount,
    balance: result.balance ?? wallet?.balance ?? 0
  });
  if (rotated) {
    setMarketplaceAuthCookies(response, rotated.accessToken, rotated.refreshToken);
  }
  return response;
}
