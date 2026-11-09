'use client';

import { useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';

// 联系卡:点击整卡(或值)即复制到剪贴板并提示;值仍可触发 tel: / 邮件。
// 邮箱默认开 mailto,800ms 未生效兜底 Gmail。右侧保留 Copy 按钮。
const L: Record<SupportedLocale, { copy: string; copied: string }> = {
  ru: { copy: 'Копировать', copied: 'Скопировано' },
  kk: { copy: 'Көшіру', copied: 'Көшірілді' },
  en: { copy: 'Copy', copied: 'Copied' },
  zh: { copy: '复制', copied: '已复制' }
};

export function ContactCard({
  label,
  value,
  locale,
  type,
  subject
}: {
  label: string;
  value: string;
  locale: SupportedLocale;
  type: 'phone' | 'email';
  subject?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = L[locale];
  const su = encodeURIComponent(subject ?? '');
  const href = type === 'phone' ? `tel:${value.replace(/[^+\d]/g, '')}` : `mailto:${value}?subject=${su}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* 忽略 */ }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function openEmail() {
    const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${value}&su=${su}`;
    let leftPage = false;
    const mark = () => { leftPage = true; };
    window.addEventListener('blur', mark, { once: true });
    document.addEventListener('visibilitychange', mark, { once: true });
    window.location.href = href;
    window.setTimeout(() => {
      window.removeEventListener('blur', mark);
      document.removeEventListener('visibilitychange', mark);
      if (!leftPage && !document.hidden) window.open(gmail, '_blank', 'noopener');
    }, 800);
  }

  return (
    <div
      className="contact-card"
      role="button"
      tabIndex={0}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          copy();
        }
      }}
    >
      <div className="contact-card-main">
        <span>{label}</span>
        {/* 值链接:邮箱走 mailto→Gmail 兜底;电话用默认 tel:;点击都会冒泡到整卡触发复制 */}
        <a
          className="contact-value"
          href={href}
          onClick={(e) => {
            if (type === 'email') {
              e.preventDefault();
              openEmail();
            }
          }}
        >
          {value}
        </a>
      </div>
      <button
        type="button"
        className={`copy-btn ${copied ? 'copied' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          copy();
        }}
      >
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}
