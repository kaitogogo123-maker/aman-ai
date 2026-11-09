import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import LandingPage from '@/app/[locale]/page';
import { HeroCollage } from '@/components/hero-collage';

describe('landing hero', () => {
  const expectedSceneSources = [
    '/collage/hero-kz-premium-look-full.webp',
    '/collage/hero-model-look-full.webp',
    '/collage/hero-kz-knit-source-full.webp'
  ];
  const expectedCardSources = [
    '/collage/hero-kz-premium-result-full.webp',
    '/collage/hero-model-result-full.webp',
    '/collage/hero-kz-knit-result-full.webp'
  ];
  const expectedFloatingSources = [
    '/collage/item-b.webp',
    '/collage/sweater.webp'
  ];
  const expectedHowSources = [
    '/collage/how-kz-photo-upload.webp',
    '/collage/how-kz-photo-select.webp',
    '/collage/how-kz-photo-result.webp'
  ];

  it('uses a concrete promotional promise without a free-card claim', async () => {
    const page = await LandingPage({ params: Promise.resolve({ locale: 'ru' }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('Фото товара');
    expect(html).toContain('карточка для Kaspi за 1 минуту');
    expect(html).toContain('Попробовать сейчас');
    expect(html).toContain('Kaspi · Wildberries · TikTok · Aman');
    expect(html).toContain('Wildberries');
    expect(html).toContain('TikTok');
    expect(html).not.toContain('бесплат');
    expect(html).not.toContain('free');
    expect(html).not.toContain('hero-trust');
    expect(html).not.toContain('Для продавцов Казахстана');
    expect(html).not.toContain('Kaspi-ready');
    expect(html).not.toContain('Русский / Қазақша / 中文');
  });

  it('shows local before-after examples before the process section', async () => {
    const page = await LandingPage({ params: Promise.resolve({ locale: 'ru' }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('Из обычного фото — готовая карточка');
    expect(html).toContain('Одежда');
    expect(html).toContain('Косметика');
    expect(html).toContain('Дом');
    expect(html).toContain('Обычное фото');
    expect(html).toContain('Готовая карточка');
    expect(html).toContain('class="proof-section"');
    expect(html).toContain('class="stats"');
    expect(html.indexOf('class="proof-section"')).toBeLessThan(html.indexOf('class="stats"'));
  });

  it('uses localized same-product comparison images in the proof section', async () => {
    const page = await LandingPage({ params: Promise.resolve({ locale: 'ru' }) });
    const html = renderToStaticMarkup(page);
    const expectedProofSources = [
      '/generated/comparisons/fashion-ru.webp',
      '/generated/comparisons/beauty-ru.webp',
      '/generated/comparisons/home-ru.webp'
    ];
    const proofHtml = html.slice(html.indexOf('class="proof-section"'), html.indexOf('class="stats"'));

    for (const source of expectedProofSources) {
      expect(proofHtml).toContain(`<img src="${source}" alt="" loading="lazy" decoding="async"/>`);
      expect(existsSync(new URL(`../../public${source}`, import.meta.url))).toBe(true);
    }

    expect(proofHtml).not.toContain('/collage/model.webp');
    expect(proofHtml).not.toContain('/collage/item-b.webp');
    expect(proofHtml).not.toContain('/collage/how-g1.webp');
  });

  it('keeps mobile hero autoplay from being paused by touch-generated mouse events', () => {
    const source = readFileSync(new URL('../../components/hero-collage.tsx', import.meta.url), 'utf8');

    expect(source).toContain("pointerType === 'mouse'");
    expect(source).toContain("document.addEventListener('visibilitychange'");
    expect(source).not.toContain('onMouseEnter');
    expect(source).not.toContain('setInterval');
  });

  it('keeps the hero visual free of duplicated marketing copy', () => {
    const html = renderToStaticMarkup(createElement(HeroCollage));

    expect(html).not.toContain('collage-bubble');
    expect(html).not.toContain('AI готовит карточку');
    expect(html).not.toContain('ready-card');
  });

  it('cycles fixed hero collage slots without swapping source and generated-card roles', () => {
    const html = renderToStaticMarkup(createElement(HeroCollage));
    const sceneSources = Array.from(html.matchAll(/src="([^"]+)"[^>]*data-collage-slot="scene"/g), (match) => match[1]);
    const cardSources = Array.from(html.matchAll(/src="([^"]+)"[^>]*data-collage-slot="card"/g), (match) => match[1]);

    expect(html.match(/data-collage-slot="scene"/g)).toHaveLength(3);
    expect(html.match(/data-collage-slot="card"/g)).toHaveLength(3);
    expect(sceneSources).toEqual(expectedSceneSources);
    expect(cardSources).toEqual(expectedCardSources);
    for (const source of [...expectedSceneSources, ...expectedCardSources, ...expectedFloatingSources]) {
      expect(existsSync(new URL(`../../public${source}`, import.meta.url))).toBe(true);
    }
    for (const source of [
      '/collage/raw-visual-photo.webp',
      '/collage/story-visual-card.webp',
      '/collage/catalog-visual-card.webp',
      '/collage/aman-visual-card.webp',
      '/collage/hero-model-look-card.webp',
      '/collage/hero-model-result-card.webp',
      '/collage/hero-kz-boutique-card.webp',
      '/collage/hero-kz-studio-card.webp',
      '/collage/hero-kz-knit-source-card.webp',
      '/collage/hero-kz-knit-result-card.webp',
      '/collage/hero-kz-item-boots.webp',
      '/collage/hero-kz-item-knit.webp'
    ]) {
      expect(html).not.toContain(source);
    }
    expect(html).not.toContain('ready-card');
  });

  it('uses the full-bleed how-it-works gallery instead of the old demo photos', async () => {
    const page = await LandingPage({ params: Promise.resolve({ locale: 'ru' }) });
    const html = renderToStaticMarkup(page);
    const howHtml = html.slice(html.indexOf('id="how-it-works"'));

    for (const source of expectedHowSources) {
      expect(howHtml).toContain(source);
      expect(existsSync(new URL(`../../public${source}`, import.meta.url))).toBe(true);
    }
    for (const source of [
      '/collage/how-g1.webp',
      '/collage/how-g2.webp',
      '/collage/how-g3.webp',
      '/collage/how-kz-upload.webp',
      '/collage/how-kz-select.webp',
      '/collage/how-kz-result.webp'
    ]) {
      expect(howHtml).not.toContain(source);
    }
  });

  it('prioritizes only the first hero collage cards for mobile loading', () => {
    const html = renderToStaticMarkup(createElement(HeroCollage));
    const tagFor = (source: string) => html.match(new RegExp(`<img src="${source}"[^>]*>`))?.[0] ?? '';

    expect(tagFor('/collage/hero-kz-premium-look-full.webp')).toContain('fetchPriority="high"');
    expect(tagFor('/collage/hero-kz-premium-result-full.webp')).toContain('fetchPriority="high"');
    expect(tagFor('/collage/hero-model-look-full.webp')).toContain('fetchPriority="low"');
    expect(tagFor('/collage/hero-model-result-full.webp')).toContain('fetchPriority="low"');
  });

  it('keeps process media autoplay from being paused by touch-generated mouse events', () => {
    const source = readFileSync(new URL('../../components/how-media.tsx', import.meta.url), 'utf8');

    expect(source).toContain("pointerType === 'mouse'");
    expect(source).not.toContain('onMouseEnter');
    expect(source).not.toContain('onMouseLeave');
  });

  it('keeps below-fold proof images lazy so old assets do not compete with the hero', async () => {
    const page = await LandingPage({ params: Promise.resolve({ locale: 'ru' }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('<img src="/generated/comparisons/fashion-ru.webp" alt="" loading="lazy" decoding="async"/>');
    expect(html).toContain('<img src="/generated/comparisons/beauty-ru.webp" alt="" loading="lazy" decoding="async"/>');
    expect(html).not.toContain('<img src="/generated/comparisons/fashion-ru.webp" alt=""/>');
  });

  it('resets autoplay timing after manual collage selection', () => {
    const source = readFileSync(new URL('../../components/hero-collage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('const goTo = useCallback');
    expect(source).toContain('onClick={() => goTo(d)}');
    expect(source).toMatch(/\}, \[next, paused, i\]\);/);
  });

  it('renders the hero collage as stacked carousel cards', () => {
    const source = readFileSync(new URL('../../components/hero-collage.tsx', import.meta.url), 'utf8');
    const html = renderToStaticMarkup(createElement(HeroCollage));

    expect(source).toContain('STACK_TURN_MS');
    expect(source).toContain('stackClassName');
    expect(source).toContain('leaving');
    expect(source).toContain('is-entering');
    expect(source).toContain('is-leaving');
    expect(source).toContain('window.setTimeout');
    expect(html.match(/class="collage-stack-card/g)).toHaveLength(6);
    expect(html.match(/data-stack-slot="scene"/g)).toHaveLength(3);
    expect(html.match(/data-stack-slot="card"/g)).toHaveLength(3);
  });
});
