import { PricingTable } from '@/components/pricing-table';
import { getMessages, resolveLocale } from '@/lib/i18n';

export default async function PricingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);

  return (
    <section className="pricing-shell">
          <div className="section-head">
            <h2>{messages.pricingTitle}</h2>
            <p>{messages.pricingSubtitle}</p>
          </div>

          <PricingTable locale={currentLocale} />
        </section>
  );
}
