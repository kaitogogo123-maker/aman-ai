'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { resolveLocale, type SupportedLocale } from '@/lib/i18n';

// 本地化 404:置于 [locale]/ 下 → 被 [locale]/layout(含 SiteShell header)包裹,
// 用户在 404 页仍能用顶部导航,不再是无头死胡同。
const COPY: Record<SupportedLocale, { title: string; body: string; home: string }> = {
  ru: { title: 'Страница не найдена', body: 'Возможно, ссылка устарела или страница была перемещена.', home: 'На главную' },
  kk: { title: 'Бет табылмады', body: 'Сілтеме ескірген немесе бет жылжытылған болуы мүмкін.', home: 'Басты бетке' },
  en: { title: 'Page not found', body: 'The link may be outdated or the page has moved.', home: 'Go to homepage' },
  zh: { title: '页面未找到', body: '链接可能已失效,或页面已被移动。', home: '返回首页' }
};

export default function LocaleNotFound() {
  const pathname = usePathname() || '/';
  const locale = resolveLocale(pathname.split('/').filter(Boolean)[0] ?? 'ru');
  const c = COPY[locale];
  return (
    <section className="notfound">
      <p className="notfound-code">404</p>
      <h1>{c.title}</h1>
      <p className="muted">{c.body}</p>
      <Link className="button primary" href={`/${locale}`}>
        {c.home}
      </Link>
    </section>
  );
}
