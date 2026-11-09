import { LocaleHtmlLangSync } from '@/components/locale-html-lang-sync';
import { Toaster } from '@/components/toast';
import { SiteShell } from '@/components/site-shell';

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  return (
    <>
      <LocaleHtmlLangSync locale={locale} />
      {/* SiteShell(header/footer/底栏)在持久 layout 内 → 跨页面切换不重建,消除切换跳动 */}
      <SiteShell>{children}</SiteShell>
      <Toaster />
    </>
  );
}
