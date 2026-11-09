'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { formatHeaderPhone } from '@/lib/core/contact';
import { getMessages, localeLabel, resolveLocale, SUPPORTED_LOCALES } from '@/lib/i18n';

// 头部登录态(对齐客户 Figma 改版):余额 + 充值按钮 + 分隔线 + 账号下拉。
// 下拉内含「语言切换 / 本人手机号 / 退出」,语言与电话从顶栏收进此菜单。
// 充值入口只创建支付订单;真实入账必须由支付回调验签后完成。
export interface HeaderAuthUser {
  phone: string;
  firstName: string;
  balance: number;
}

export function HeaderAuth({ locale, pathname }: { locale: string; pathname: string }) {
  const cl = resolveLocale(locale);
  const t = getMessages(cl);
  const router = useRouter();
  const [user, setUser] = useState<HeaderAuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // header 在共享 layout 里持久挂载,不随导航重建。路径变化时重拉 /me,
  // 否则登录/注册跳转后头部仍显示"登录"、退出后仍显示账户(登录态不刷新)。
  useEffect(() => {
    let active = true;
    fetch('/api/v1/auth/me')
      .then((r) => r.json())
      .then((d: { user: HeaderAuthUser | null }) => {
        if (active) {
          setUser(d.user);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  // 下拉:点击外部 / Esc 关闭
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setLangOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function logout() {
    setBusy(true);
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    try {
      localStorage.removeItem('aman_auth');
    } catch {
      /* 忽略 */
    }
    setUser(null);
    setMenuOpen(false);
    setBusy(false);
    router.push(`/${cl}`);
    router.refresh();
  }

  if (!loaded) {
    return <span className="header-auth-placeholder" aria-hidden="true" />;
  }

  if (user) {
    return (
      <div className="header-account">
        <div className="header-menu-wrap" ref={wrapRef}>
          <button
            type="button"
            className="header-account-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="header-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8.5" r="3.5" />
                <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
              </svg>
            </span>
            <span className="header-username">{user.firstName}</span>
            <svg className={`header-caret ${menuOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuOpen ? (
            <div className="header-menu" role="menu">
              <Link
                href={`/${cl}/orders`}
                className="header-menu-row header-menu-link"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setLangOpen(false);
                }}
              >
                <span>{t.orders.navOrders}</span>
                <svg className="header-caret-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
              <button
                type="button"
                className="header-menu-row"
                role="menuitem"
                onClick={() => setLangOpen((o) => !o)}
                aria-expanded={langOpen}
              >
                <span>{t.languageLabel}</span>
                <span className="header-menu-value">
                  {localeLabel(cl)}
                  <svg className={`header-caret-right ${langOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </button>

              {langOpen ? (
                <div className="header-lang-list">
                  {SUPPORTED_LOCALES.map((entry) => (
                    <Link
                      key={entry}
                      href={`/${entry}${pathname}`}
                      className={`header-lang-opt ${entry === cl ? 'active' : ''}`}
                      onClick={() => {
                        setMenuOpen(false);
                        setLangOpen(false);
                      }}
                    >
                      {localeLabel(entry)}
                    </Link>
                  ))}
                </div>
              ) : null}

              <div className="header-menu-phone">{formatHeaderPhone(user.phone)}</div>
              <div className="header-menu-sep" />
              <button type="button" className="header-menu-row header-menu-logout" role="menuitem" onClick={logout} disabled={busy}>
                {t.accountLogout}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // 未登录:无账号下拉,语言切换在此随登录按钮一并展示(登录后语言移入下拉)
  const active = ['/login', '/register', '/recover'].includes(pathname);
  return (
    <div className="header-loggedout">
      <LocaleSwitcher locale={cl} pathname={pathname} />
      <Link className={`nav-login ${active ? 'active' : ''}`} href={`/${cl}/login`}>
        {t.auth.loginNav}
      </Link>
    </div>
  );
}
