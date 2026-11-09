import Link from 'next/link';
import { ContactsNav } from '@/components/contacts-nav';
import { SocialLinks } from '@/components/social-links';
import { SUPPORT_PHONE_DISPLAY, phoneToTelHref } from '@/lib/core/contact';
import { getMessages, resolveLocale } from '@/lib/i18n';

// 深色页脚:品牌 navy 底 + 透明银色 logo,左右布局(矮)。联系我们开弹窗(同顶部),无邮箱。

export function SiteFooter({ locale }: { locale: string }) {
  const cl = resolveLocale(locale);
  const m = getMessages(cl);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          {/* 页脚 logo 与顶部 logo 一致:点击回首页 */}
          <Link className="footer-logo-link" href={`/${cl}`} aria-label="AMAN AI">
            <img className="footer-logo" src="/aman-ai-logo-dark.webp" alt="AMAN AI" width={96} height={64} />
          </Link>
          <span className="footer-copy">© 2026 AMAN AI</span>
        </div>
        <div className="footer-right">
          <nav className="footer-nav">
            <Link href={`/${cl}#how-it-works`}>{m.navHowItWorks}</Link>
            <Link href={`/${cl}/pricing`}>{m.navPricing}</Link>
            <ContactsNav locale={cl} />
          </nav>
          <a className="footer-phone" href={phoneToTelHref(SUPPORT_PHONE_DISPLAY)}>{SUPPORT_PHONE_DISPLAY}</a>
          <SocialLinks includeWhatsApp />
        </div>
      </div>
    </footer>
  );
}
