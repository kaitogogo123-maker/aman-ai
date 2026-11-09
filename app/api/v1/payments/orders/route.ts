import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRuntimeEnv } from '@/lib/config/env';
import { getSessionUid } from '@/lib/core/auth/cookie';
import { createMarketplaceAuthClient } from '@/lib/core/auth/marketplace-client';
import { readMarketplaceTokens, setMarketplaceAuthCookies } from '@/lib/core/auth/marketplace-session';
import { createPackageOrder } from '@/lib/core/payment/marketplace-payment';
import { productIdForImages } from '@/lib/core/payment/packages';
import { priceForCount } from '@/lib/core/pricing';
import { resolveLocale } from '@/lib/i18n';

// 套餐购买:选张数 → 建对应 AMAN 套餐商品订单(带精确金额 customAmount + 回跳 URL)→ 返回银行支付页 url。
// 付款完成后银行按 redirectSuccessUrl 回跳到 tamga,前端再调 /api/v1/payments/settle 入账。
const schema = z.object({
  images: z.coerce.number().int().min(1).max(5),
  locale: z.string().optional()
});

export async function POST(request: NextRequest) {
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const productId = productIdForImages(parsed.data.images);
  if (!productId) {
    return NextResponse.json({ error: 'INVALID_PACKAGE' }, { status: 400 });
  }

  const { accessToken, refreshToken } = readMarketplaceTokens(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'NO_MARKETPLACE_SESSION' }, { status: 401 });
  }

  const env = getRuntimeEnv();
  // 精确金额 = 按张数的套餐价(1张500/2张1000/3张1500/4张2000/5张1500);回跳指回 tamga 本站。
  const locale = resolveLocale(parsed.data.locale ?? 'ru');
  const origin = new URL(request.url).origin;
  const orderOptions = {
    customAmount: priceForCount(parsed.data.images),
    redirectSuccessUrl: `${origin}/${locale}/app?payment=success`,
    redirectFailUrl: `${origin}/${locale}/app?payment=failed`
  };

  let result = await createPackageOrder(env.MARKETPLACE_API_BASE_URL, accessToken, productId, orderOptions);
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  // access token 1h 过期 → 用 refresh token 续一次重试
  if (!result.ok && result.status === 401 && refreshToken) {
    const refreshed = await createMarketplaceAuthClient({ baseUrl: env.MARKETPLACE_API_BASE_URL }).refresh(refreshToken);
    if (refreshed.ok) {
      rotated = refreshed.data;
      result = await createPackageOrder(env.MARKETPLACE_API_BASE_URL, rotated.accessToken, productId, orderOptions);
    }
  }

  if (!result.ok) {
    const status = result.status === 401 ? 401 : 502;
    return NextResponse.json({ error: 'ORDER_CREATE_FAILED', upstreamStatus: result.status }, { status });
  }

  const response = NextResponse.json({ url: result.url });
  if (rotated) {
    setMarketplaceAuthCookies(response, rotated.accessToken, rotated.refreshToken);
  }
  return response;
}
