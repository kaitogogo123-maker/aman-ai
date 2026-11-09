import { NextRequest, NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/config/env';
import { getSessionUid } from '@/lib/core/auth/cookie';
import { createMarketplaceAuthClient } from '@/lib/core/auth/marketplace-client';
import { readMarketplaceTokens, setMarketplaceAuthCookies } from '@/lib/core/auth/marketplace-session';

// 「我的-订单」代理:用 marketplace accessToken 打 aman.kz 的 GET /profile/orders。
// country=kz 本地商品(productDTO)/ ch 中国商品(productChDTO)。客户从 JWT 识别,前端不传 customerId。

function buildUpstreamUrl(base: string): (search: URLSearchParams) => string {
  const root = base.replace(/\/+$/, '');
  return (search) => {
    const country = search.get('country') === 'ch' ? 'ch' : 'kz'; // 只允许 kz/ch,默认 kz
    const params = new URLSearchParams({ country });
    params.set('page', String(Number(search.get('page')) || 0));
    params.set('size', String(Number(search.get('size')) || 10));
    params.set('sort', search.get('sort') || 'createdDate,desc');
    return `${root}/profile/orders?${params.toString()}`;
  };
}

export async function GET(request: NextRequest) {
  // 订单归属当前登录用户;未登录直接拦。
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { accessToken, refreshToken } = readMarketplaceTokens(request);
  if (!accessToken) {
    // 本地登录但无 marketplace 会话(如 local auth 模式)→ 无订单可查
    return NextResponse.json({ error: 'NO_MARKETPLACE_SESSION' }, { status: 401 });
  }

  const env = getRuntimeEnv();
  const upstreamUrl = buildUpstreamUrl(env.MARKETPLACE_API_BASE_URL)(request.nextUrl.searchParams);

  const fetchOrders = (token: string) =>
    fetch(upstreamUrl, { headers: { authorization: `Bearer ${token}` } });

  let upstream = await fetchOrders(accessToken);
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  // access token 1h 过期 → 用 refresh token 续一次再重试
  if (upstream.status === 401 && refreshToken) {
    const refreshed = await createMarketplaceAuthClient({ baseUrl: env.MARKETPLACE_API_BASE_URL }).refresh(refreshToken);
    if (refreshed.ok) {
      rotated = refreshed.data;
      upstream = await fetchOrders(rotated.accessToken);
    }
  }

  if (!upstream.ok) {
    const status = upstream.status === 401 ? 401 : 502;
    return NextResponse.json({ error: 'ORDERS_UPSTREAM_ERROR', upstreamStatus: upstream.status }, { status });
  }

  const page = await upstream.json().catch(() => ({ content: [], empty: true }));
  const response = NextResponse.json(page);
  // 续了新 token 就写回 cookie,保持会话
  if (rotated) {
    setMarketplaceAuthCookies(response, rotated.accessToken, rotated.refreshToken);
  }
  return response;
}
