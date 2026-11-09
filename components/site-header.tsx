'use client';

import Link from 'next/link';
import { AmanLogo } from '@/components/aman-logo';
import { ContactsNav } from '@/components/contacts-nav';
import { HeaderAuth } from '@/components/header-auth';
import { getMessages, resolveLocale } from '@/lib/i18n';

// Aman AI 公共顶部导航：logo + 营销导航 + 账号区(余额/充值/账号下拉,语言与电话收进下拉)；
// app 页可额外显示「Создать / История」切换。showPhone 已废弃(电话移入账号下拉),保留以兼容调用方。

export function SiteHeader({
  locale,
  pathname,
  appNav,
  backHref,
  backLabel
}: {
  locale: string;
  pathname: string;
  showPhone?: boolean;
  appNav?: 'create' | 'history';
  backHref?: string;
  backLabel?: string;
}) {
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);

  return (
    <>
    <header className="topbar site-header">
      <Link className="site-logo" href={`/${currentLocale}`} aria-label="AMAN AI">
        <AmanLogo height={64} />
      </Link>

      <nav className="nav site-nav">
        <Link className="nav-link" href={`/${currentLocale}#how-it-works`}>
          {messages.navHowItWorks}
        </Link>
        <Link className="nav-link" href={`/${currentLocale}/pricing`}>
          {messages.navPricing}
        </Link>
        <ContactsNav locale={currentLocale} />
      </nav>

      <div className="site-header-right">
        <HeaderAuth locale={currentLocale} pathname={pathname} />
      </div>
    </header>

    {appNav ? (
      <div className="app-subnav">
        {backHref ? (
          <Link className="back-link" href={backHref}>
            ← {backLabel ?? messages.backLabel}
          </Link>
        ) : null}
        <div className="header-actions" role="group">
          <Link className={`pill ${appNav === 'create' ? 'active' : ''}`} href={`/${currentLocale}/app`}>
            {messages.navCreate}
          </Link>
          <Link className={`pill ${appNav === 'history' ? 'active' : ''}`} href={`/${currentLocale}/history`}>
            {messages.navHistory}
          </Link>
        </div>
      </div>
    ) : null}
    </>
  );
}
