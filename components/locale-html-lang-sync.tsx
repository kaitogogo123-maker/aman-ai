'use client';

import { useEffect } from 'react';
import { resolveLocale } from '@/lib/i18n';

export function LocaleHtmlLangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = resolveLocale(locale);
  }, [locale]);

  return null;
}
