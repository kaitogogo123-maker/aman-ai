// 取客户端真实 IP,用于发起支付时的 client_ip_address 字段。
// tamga 跑在 Cloudflare Workers:CF-Connecting-IP 是 Cloudflare 注入的真实客户端 IP(最可信);
// 回退 X-Forwarded-For 第一个;再回退占位,避免发起支付时字段缺失。
export function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return '0.0.0.0';
}
