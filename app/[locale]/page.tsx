import Link from 'next/link';
import { HeroCollage } from '@/components/hero-collage';
import { HowMedia } from '@/components/how-media';
import { getMessages, resolveLocale, type SupportedLocale } from '@/lib/i18n';

const HOW_GALLERY = ['/collage/how-kz-photo-upload.webp', '/collage/how-kz-photo-select.webp', '/collage/how-kz-photo-result.webp'];
const LANDING_MARKETPLACE_LINE: Record<SupportedLocale, string> = {
  ru: 'Kaspi · Wildberries · TikTok · Aman',
  kk: 'Kaspi · Wildberries · TikTok · Aman',
  en: 'Kaspi · Wildberries · TikTok · Aman',
  zh: 'Kaspi · Wildberries · TikTok · Aman'
};

const BEFORE_AFTER_COPY: Record<
  SupportedLocale,
  {
    title: string;
    subtitle: string;
    beforeLabel: string;
    afterLabel: string;
    examples: { title: string; body: string; comparisonSrc: string }[];
  }
> = {
  ru: {
    title: 'Из обычного фото — готовая карточка',
    subtitle: 'Покажите товар так, как его ожидают покупатели на маркетплейсах.',
    beforeLabel: 'Обычное фото',
    afterLabel: 'Готовая карточка',
    examples: [
      {
        title: 'Одежда',
        body: 'Фото товара → карточка для Kaspi / Wildberries',
        comparisonSrc: '/generated/comparisons/fashion-ru.webp'
      },
      {
        title: 'Косметика',
        body: 'Обычное фото → чистая карточка с преимуществами',
        comparisonSrc: '/generated/comparisons/beauty-ru.webp'
      },
      {
        title: 'Дом',
        body: 'Товарное фото → готовый визуал для каталога',
        comparisonSrc: '/generated/comparisons/home-ru.webp'
      }
    ]
  },
  kk: {
    title: 'Қарапайым фото — дайын карточка',
    subtitle: 'Тауарды marketplace сатып алушылары күтетін форматта көрсетіңіз.',
    beforeLabel: 'Қарапайым фото',
    afterLabel: 'Дайын карточка',
    examples: [
      {
        title: 'Киім',
        body: 'Тауар фотосы → Kaspi / Wildberries карточкасы',
        comparisonSrc: '/generated/comparisons/fashion-kk.webp'
      },
      {
        title: 'Косметика',
        body: 'Қарапайым фото → артықшылықтары бар таза карточка',
        comparisonSrc: '/generated/comparisons/beauty-kk.webp'
      },
      {
        title: 'Үй',
        body: 'Тауар фотосы → каталогқа дайын визуал',
        comparisonSrc: '/generated/comparisons/home-kk.webp'
      }
    ]
  },
  en: {
    title: 'From a simple photo to a product card',
    subtitle: 'Show products in the format marketplace buyers already expect.',
    beforeLabel: 'Simple photo',
    afterLabel: 'Ready card',
    examples: [
      {
        title: 'Fashion',
        body: 'Product photo → Kaspi / Wildberries card',
        comparisonSrc: '/generated/comparisons/fashion-en.webp'
      },
      {
        title: 'Beauty',
        body: 'Simple photo → clean card with selling points',
        comparisonSrc: '/generated/comparisons/beauty-en.webp'
      },
      {
        title: 'Home',
        body: 'Product photo → catalog-ready visual',
        comparisonSrc: '/generated/comparisons/home-en.webp'
      }
    ]
  },
  zh: {
    title: '普通商品图，变成可用商品卡',
    subtitle: '用买家熟悉的 marketplace 视觉方式展示商品。',
    beforeLabel: '普通照片',
    afterLabel: '成品卡片',
    examples: [
      {
        title: '服装',
        body: '商品照片 → Kaspi / Wildberries 商品卡',
        comparisonSrc: '/generated/comparisons/fashion-zh.webp'
      },
      {
        title: '美妆',
        body: '普通照片 → 带卖点的干净商品卡',
        comparisonSrc: '/generated/comparisons/beauty-zh.webp'
      },
      {
        title: '家居',
        body: '商品照片 → 可用于目录的销售图',
        comparisonSrc: '/generated/comparisons/home-zh.webp'
      }
    ]
  }
};

export default async function LandingPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const beforeAfter = BEFORE_AFTER_COPY[currentLocale];

  return (
    <>
        <section className="hero">
          <div>
            <h1>
              {messages.landingTitle} <em>{messages.landingAccent}</em>
            </h1>
            <p>{messages.landingBody}</p>
            <p className="hero-marketplaces" aria-label="Marketplace support">
              {LANDING_MARKETPLACE_LINE[currentLocale]}
            </p>
            <div className="hero-actions">
              <Link className="button primary" href={`/${currentLocale}/app`}>
                {messages.landingOpenApp}
              </Link>
            </div>
          </div>

          <HeroCollage />
        </section>

        <section className="proof-section" aria-labelledby="proof-title">
          <div className="section-head proof-head">
            <h2 id="proof-title">{beforeAfter.title}</h2>
            <p>{beforeAfter.subtitle}</p>
          </div>
          <div className="proof-grid">
            {beforeAfter.examples.map((example) => (
              <article className="proof-card" key={example.title}>
                <div className="proof-media" aria-label={`${beforeAfter.beforeLabel} → ${beforeAfter.afterLabel}`}>
                  <img src={example.comparisonSrc} alt="" loading="lazy" decoding="async" />
                </div>
                <h3>{example.title}</h3>
                <p>{example.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <b>5</b>
            <span>{messages.statImageTypes}</span>
          </div>
          <div className="stat">
            <b>3</b>
            <span>{messages.statSteps}</span>
          </div>
          <div className="stat">
            <b>4</b>
            <span>{messages.statLanguages}</span>
          </div>
          <div className="stat">
            <b>1000+</b>
            <span>{messages.statUsers}</span>
          </div>
        </section>

        <section id="how-it-works" className="how-section">
          <div className="section-head">
            <h2>{messages.howTitle}</h2>
            <p>{messages.howSubtitle}</p>
          </div>
          <div className="how-steps">
            <HowStep
              num={1}
              title={messages.how1Title}
              body={messages.how1Body}
              bullets={messages.how1Bullets}
              images={[HOW_GALLERY[0], HOW_GALLERY[1], HOW_GALLERY[2]]}
              badge="/collage/badge-wb.webp"
            />
            <HowStep
              num={2}
              title={messages.how2Title}
              body={messages.how2Body}
              images={[HOW_GALLERY[1], HOW_GALLERY[2], HOW_GALLERY[0]]}
            />
            <HowStep
              num={3}
              title={messages.how3Title}
              body={messages.how3Body}
              bullets={messages.how3Bullets}
              images={[HOW_GALLERY[2], HOW_GALLERY[0], HOW_GALLERY[1]]}
              badge="/collage/badge-ozon.webp"
            />
          </div>
        </section>
    </>
  );
}

function HowStep({
  num,
  title,
  body,
  bullets,
  images,
  badge
}: {
  num: number;
  title: string;
  body: string;
  bullets?: readonly string[];
  images: string[];
  badge?: string;
}) {
  return (
    <div className="how-step">
      <div>
        <span className="how-step-num">{num}</span>
        <h3>{title}</h3>
        <p>{body}</p>
        {bullets ? (
          <ul className="how-bullets">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <HowMedia images={images} badge={badge} />
    </div>
  );
}
