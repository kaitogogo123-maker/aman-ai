import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/en/app'
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: unknown; href: string; className?: string }) =>
    createElement('a', { href, className }, children)
}));

vi.mock('@/components/locale-switcher', () => ({
  LocaleSwitcher: ({ locale }: { locale: string }) => createElement('span', { className: 'locale-switcher' }, locale)
}));

import ContactsPage from '@/app/[locale]/contacts/page';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TamgaApp } from '@/components/tamga-app';

describe('customer feedback UI regressions', () => {
  it('uses the updated support number in public contact surfaces', async () => {
    const footerHtml = renderToStaticMarkup(createElement(SiteFooter, { locale: 'en' }));
    const contactsPage = await ContactsPage({ params: Promise.resolve({ locale: 'en' }) });
    const contactsHtml = renderToStaticMarkup(contactsPage);

    expect(`${footerHtml}${contactsHtml}`).toContain('+7 700 905 0988');
    expect(`${footerHtml}${contactsHtml}`).not.toContain('+7 (700) 902-09-88');
    expect(`${footerHtml}${contactsHtml}`).not.toContain('+7-700-902-09-88');
  });

  it('does not render a static support number in the header phone slot', () => {
    const html = renderToStaticMarkup(createElement(SiteHeader, { locale: 'en', pathname: '/app', showPhone: true }));

    expect(html).not.toContain('+7 (700) 902-09-88');
    expect(html).not.toContain('+7 700 905 0988');
  });

  it('removes the deprecated preview marketing copy from the create workspace', () => {
    const html = renderToStaticMarkup(createElement(TamgaApp, { locale: 'en' }));

    expect(html).not.toContain('Generate localized marketplace visuals');
    expect(html).not.toContain('Upload a product, choose the target language and formats');
    expect(html).not.toContain('PREVIEW');
  });

  it('does not keep the removed preview copy in app source strings', () => {
    const source = [
      readFileSync(new URL('../../components/tamga-app.tsx', import.meta.url), 'utf8'),
      readFileSync(new URL('../../lib/i18n.ts', import.meta.url), 'utf8')
    ].join('\n');

    expect(source).not.toContain('Generate localized marketplace visuals');
    expect(source).not.toContain('Upload a product, choose the target language and formats');
  });

  it('keeps the contacts modal text color independent from footer link color', () => {
    const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
    const modalBlock = css.match(/\.contacts-modal\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
    const titleBlock = css.match(/\.contacts-modal-title\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';

    expect(modalBlock).toMatch(/color:\s*var\(--ink\)/);
    expect(titleBlock).toMatch(/color:\s*var\(--ink\)/);
  });
});
