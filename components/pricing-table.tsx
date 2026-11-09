'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PRICING_TIERS } from '@/lib/core/pricing';
import { getMessages, resolveLocale } from '@/lib/i18n';

// 价格档位可点击切换:点选某档高亮(蓝),「Start」带所选张数进入生图页(付费在生图时进行)。
export function PricingTable({ locale }: { locale: string }) {
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const bestCount = PRICING_TIERS.find((t) => t.best)?.count ?? PRICING_TIERS[0].count;
  const [selected, setSelected] = useState<number>(bestCount);

  return (
    <>
      <div className="pricing-table">
        {PRICING_TIERS.map((tier) =>
          tier.plus ? (
            // 「5+ 张」信息行：展示每张单价,不参与档位选择
            <div key="plus" className="pricing-row pricing-row-plus">
              <span>{messages.pricingPlusLabel}</span>
              <b>
                {tier.price} {messages.currencyTenge} {messages.pricingPerImageSuffix}
              </b>
            </div>
          ) : (
            <button
              key={tier.count}
              type="button"
              className={`pricing-row ${tier.best ? 'best' : ''} ${selected === tier.count ? 'selected' : ''}`}
              onClick={() => setSelected(tier.count)}
              aria-pressed={selected === tier.count}
            >
              {tier.best ? <span className="pricing-badge">{messages.pricingBadge}</span> : null}
              <span>{messages.pricingImagesLabel(tier.count)}</span>
              <b>
                {tier.price} {messages.currencyTenge}
              </b>
            </button>
          )
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Link className="button primary" href={`/${currentLocale}/app?count=${selected}`}>
          {messages.pricingCta}
        </Link>
      </div>
    </>
  );
}
