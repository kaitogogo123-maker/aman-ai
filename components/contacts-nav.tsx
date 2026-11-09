'use client';

import { useEffect, useState } from 'react';
import { SocialLinks } from '@/components/social-links';
import { SUPPORT_PHONE_DIGITS, SUPPORT_PHONE_DISPLAY, phoneToTelHref } from '@/lib/core/contact';
import { getMessages, resolveLocale } from '@/lib/i18n';

// Header「联系我们」点击 → 弹出 Figma 同款「Наши контакты」模态框:
// 支持电话 + Позвонить(tel:)+ Отправить СМС(打开 WhatsApp,客户确认)+ 关闭。
export function ContactsNav({ locale }: { locale: string }) {
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const [open, setOpen] = useState(false);
  const tel = phoneToTelHref(SUPPORT_PHONE_DISPLAY);
  // 「Отправить СМС」按钮打开 WhatsApp 对话(wa.me 需国际号纯数字,无 +)
  const whatsapp = `https://wa.me/${SUPPORT_PHONE_DIGITS}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="nav-link nav-link-btn" onClick={() => setOpen(true)}>
        {messages.navContacts}
      </button>

      {open ? (
        <div className="contacts-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="contacts-modal"
            role="dialog"
            aria-modal="true"
            aria-label={messages.contactsTitle}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="contacts-modal-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2 className="contacts-modal-title">{messages.contactsTitle}</h2>

            <div className="contacts-modal-field">
              <span className="label">{messages.supportNumberLabel}</span>
              <span className="contacts-modal-phone">{SUPPORT_PHONE_DISPLAY}</span>
            </div>

            <a className="button primary contacts-modal-btn" href={tel}>
              {messages.contactCallLabel}
            </a>
            <a className="button primary contacts-modal-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
              {messages.contactSmsLabel}
            </a>

            <SocialLinks includeWhatsApp />
          </div>
        </div>
      ) : null}
    </>
  );
}
