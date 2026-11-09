import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// 登录上下文:从请求头 + Cloudflare cf 对象提取 IP/地理/设备信息,写入 auth_events.metadata。
// 全部尽力而为:本地/无 cf 时对应字段为 undefined,绝不抛错、绝不阻断登录。
export interface LoginContext {
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
  isp?: string;
  lang?: string; // 浏览器语言偏好(Accept-Language 首选)
  ua?: string;
  os?: string;
  browser?: string;
  device?: string;
}

export function collectLoginContext(request: NextRequest): LoginContext {
  const h = request.headers;
  const ua = h.get('user-agent') ?? undefined;
  const cf = readCf();

  const ctx: LoginContext = {
    ip: firstIp(h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')),
    country: str(cf?.country) ?? h.get('cf-ipcountry') ?? undefined,
    city: str(cf?.city),
    region: str(cf?.region),
    timezone: str(cf?.timezone),
    isp: str(cf?.asOrganization),
    lang: firstLang(h.get('accept-language')),
    ua: ua ? ua.slice(0, 400) : undefined,
    ...parseUserAgent(ua)
  };

  // 去掉 undefined,jsonb 里不留空键
  return Object.fromEntries(Object.entries(ctx).filter(([, v]) => v != null && v !== '')) as LoginContext;
}

function readCf(): Record<string, unknown> | undefined {
  try {
    return getCloudflareContext().cf as Record<string, unknown> | undefined;
  } catch {
    return undefined;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function firstIp(value: string | null): string | undefined {
  if (!value) return undefined;
  const ip = value.split(',')[0]?.trim();
  return ip || undefined;
}

function firstLang(value: string | null): string | undefined {
  if (!value) return undefined;
  const lang = value.split(',')[0]?.split(';')[0]?.trim();
  return lang || undefined;
}

// 轻量 UA 解析(不引第三方依赖):够后台展示 iOS/Android 占比、桌面/移动、以及社交内置浏览器即可。
export function parseUserAgent(ua: string | undefined): { os?: string; browser?: string; device?: string } {
  if (!ua) return {};
  const os = /iPhone|iPad|iPod|iOS|CFNetwork|Darwin/i.test(ua) // Darwin/CFNetwork=iOS 原生/App
    ? 'iOS'
    : /Android|okhttp/i.test(ua) // okhttp=Android 原生 App 常见
      ? 'Android'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : undefined;

  // 先认社交内置浏览器(KZ 社交导流常见:UA 里含 Safari/Chrome 但其实是 App 内)
  const inApp = /Instagram/i.test(ua)
    ? 'Instagram'
    : /FBAN|FBAV|FB_IAB/i.test(ua)
      ? 'Facebook'
      : /Line\//i.test(ua)
        ? 'LINE'
        : /MicroMessenger/i.test(ua)
          ? 'WeChat'
          : /Telegram/i.test(ua)
            ? 'Telegram'
            : /TikTok|musical_ly|BytedanceWebview/i.test(ua)
              ? 'TikTok'
              : /KAKAOTALK/i.test(ua)
                ? 'KakaoTalk'
                : undefined;

  const browser =
    inApp ??
    (/Edg\//i.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/i.test(ua)
        ? 'Opera'
        : /YaBrowser/i.test(ua) // Yandex,俄语区常见
          ? 'Yandex'
          : /Chrome\/|CriOS\//i.test(ua)
            ? 'Chrome'
            : /Firefox\/|FxiOS\//i.test(ua)
              ? 'Firefox'
              : /Safari\//i.test(ua)
                ? 'Safari'
                : /okhttp|CFNetwork|Dart|Flutter/i.test(ua)
                  ? 'App' // 原生 App/HTTP 客户端
                  : undefined);

  const device = /iPad|Tablet/i.test(ua)
    ? 'Tablet'
    : /Mobi|Android|iPhone|iPod/i.test(ua)
      ? 'Mobile'
      : 'Desktop';

  return { os, browser, device };
}
