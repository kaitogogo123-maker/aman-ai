import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { resolveLocale } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  // 必须设 metadataBase,否则 og:image/twitter:image 会回退成 http://localhost:3000 → 抓取器拿不到图,
  // 分享预览无图。换自定义域名后改这里即可。
  metadataBase: new URL('https://tamga.kaitogogo123.workers.dev'),
  title: 'Aman AI',
  description: 'AI product image engine for CIS ecommerce.',
  // 关掉 iOS 自动电话号识别:否则它会把页面里展示的号码二次包成自己的链接(灰色 + 点击后系统弹窗返回时文本丢失)。
  // 拨号由显式的 tel:/wa.me 按钮负责,不受影响。
  formatDetection: { telephone: false },
  // og 图用 public 静态文件 /og.png(Cloudflare 边缘直出,不走 Worker、不受冷启动影响),
  // 而非 Next 路由版 /opengraph-image.png(走 Worker,冷启动时抓取器超时 → 预览间歇性无图)
  openGraph: {
    type: 'website',
    siteName: 'Aman AI',
    url: 'https://tamga.kaitogogo123.workers.dev',
    title: 'Aman AI',
    description: 'AI product image engine for CIS ecommerce.',
    images: [{ url: '/og.png', width: 1200, height: 630, type: 'image/png', alt: 'Aman AI' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aman AI',
    description: 'AI product image engine for CIS ecommerce.',
    images: ['/og.png']
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover'
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const locale = resolveLocale(requestHeaders.get('x-locale') ?? cookieStore.get('locale')?.value ?? 'ru');

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
