import { ContactCard } from '@/components/contact-card';
import { SUPPORT_PHONE_DISPLAY } from '@/lib/core/contact';
import { getMessages, resolveLocale, type SupportedLocale } from '@/lib/i18n';

const EMAIL_SUBJECT: Record<SupportedLocale, string> = {
  ru: 'Запрос — Aman AI',
  kk: 'Сұраныс — Aman AI',
  en: 'Inquiry — Aman AI',
  zh: 'Aman AI 咨询'
};

export default async function ContactsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);

  return (
    <section className="contacts-shell">
          <div className="section-head">
            <h2>{messages.contactsTitle}</h2>
            <p>{messages.contactsSubtitle}</p>
          </div>

          <div className="contacts-grid">
            <ContactCard label={messages.contactPhoneLabel} value={SUPPORT_PHONE_DISPLAY} locale={currentLocale} type="phone" />
            <ContactCard
              label={messages.contactEmailLabel}
              value={messages.contactEmail}
              locale={currentLocale}
              type="email"
              subject={EMAIL_SUBJECT[currentLocale]}
            />
          </div>
        </section>
  );
}
