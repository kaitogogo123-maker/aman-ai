import Link from 'next/link';
import { SUPPORTED_LOCALES, localeLabel, resolveLocale } from '@/lib/i18n';

export function LocaleSwitcher({
  locale,
  pathname
}: {
  locale: string;
  pathname: string;
}) {
  const currentLocale = resolveLocale(locale);

  return (
    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      {SUPPORTED_LOCALES.map((entry, index) => (
        <span key={entry} style={{ display: 'inline-flex', gap: 8 }}>
          {index > 0 ? <span>/</span> : null}
          {entry === currentLocale ? (
            <b>{localeLabel(entry)}</b>
          ) : (
            <Link href={`/${entry}${pathname}`}>
              {localeLabel(entry)}
            </Link>
          )}
        </span>
      ))}
    </span>
  );
}
