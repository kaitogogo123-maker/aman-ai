import { describe, expect, it } from 'vitest';
import {
  detectPreferredLocale,
  fontStyleLabel,
  getMessages,
  imageKindLabel,
  outputLanguageLabel,
  SUPPORTED_LOCALES,
  type SupportedLocale
} from '@/lib/i18n';
import type { ImageKind } from '@/lib/core/generation/types';

describe('detectPreferredLocale', () => {
  it('prefers kazakh when accept-language starts with kk', () => {
    expect(detectPreferredLocale('kk-KZ,ru;q=0.9,en;q=0.8')).toBe('kk');
  });

  it('prefers chinese when accept-language starts with zh', () => {
    expect(detectPreferredLocale('zh-CN,zh;q=0.9,en;q=0.8')).toBe('zh');
  });

  it('falls back to russian when no supported locale is present', () => {
    expect(detectPreferredLocale('de-DE,de;q=0.9')).toBe('ru');
  });
});

describe('outputLanguageLabel', () => {
  it('uses English language names in the selector', () => {
    expect(outputLanguageLabel('ru')).toBe('Russian');
    expect(outputLanguageLabel('kk')).toBe('Kazakh');
    expect(outputLanguageLabel('en')).toBe('English');
    expect(outputLanguageLabel('zh')).toBe('Chinese');
  });
});

describe('fontStyleLabel', () => {
  it('returns localized font style labels', () => {
    expect(fontStyleLabel('en', 'auto')).toBe('Auto');
    expect(fontStyleLabel('zh', 'geometric_sans')).toBe('时尚简约');
    expect(fontStyleLabel('ru', 'bold_sans')).toBe('Жирный заголовок');
    expect(fontStyleLabel('kk', 'elegant_serif')).toBe('Әсем');
  });
});

describe('localized marketing copy', () => {
  it('labels the selector as generated-image text language in every locale', () => {
    expect(getMessages('zh').imageLanguage).toBe('生成图片文字语言');
    expect(getMessages('en').imageLanguage).toBe('Generated image text language');
    expect(getMessages('ru').imageLanguage).toBe('Язык текста на готовом изображении');
    expect(getMessages('kk').imageLanguage).toBe('Дайын суреттегі мәтін тілі');
  });

  it('uses the Aman AI redesign landing headline per locale', () => {
    expect(getMessages('ru').landingTitle).toBe('Фото товара →');
    expect(getMessages('ru').landingAccent).toBe('карточка для Kaspi за 1 минуту');
    expect(getMessages('kk').landingTitle).toBe('Тауар фотосы →');
    expect(getMessages('zh').landingTitle).toBe('商品照片 →');
  });

  it('uses non-technical API/stat copy across locales', () => {
    expect(getMessages('ru').statApiReady).toBe('API-ядро готово');
    expect(getMessages('kk').statApiReady).toBe('API өзегі дайын');
    expect(getMessages('zh').statApiReady).toBe('API 核心已就绪');
  });

  it('renders Create button without count per customer doc', () => {
    // 客户原文 "🔥 Create image" - 主按钮固定文案不带计数
    expect(getMessages('ru').generateImages(1)).toBe('Создать изображение');
    expect(getMessages('ru').generateImages(3)).toBe('Создать изображение');
    expect(getMessages('en').generateImages(1)).toBe('Create image');
    expect(getMessages('en').generateImages(5)).toBe('Create image');
    // creatingImages 不属于主按钮文案,保留计数表达 (用于结果页"正在生成 N 张")
    expect(getMessages('ru').creatingImages(5)).toBe('Создаём 5 изображений');
  });

  it('uses the Marketplace 4-20 character password hint', () => {
    expect(getMessages('en').auth.regPasswordHint).toBe('4-20 characters');
    expect(getMessages('ru').auth.regPasswordHint).toContain('4');
    expect(getMessages('ru').auth.regPasswordHint).toContain('20');
  });
});

// 守护客户文档要求的 5 类图片 emoji + 命名: product 和 model 模式各有一套, 任何 locale 都不准漏掉
describe('imageKindLabel (客户反馈守护)', () => {
  const ALL_KINDS: ImageKind[] = ['selling', 'white', 'scene', 'closeup', 'closeup_white'];

  it('每个 locale × mode × kind 都返回非空字符串, 且不含 emoji(按设计已去除)', () => {
    const EMOJI_RE = /\p{Extended_Pictographic}/u;
    SUPPORTED_LOCALES.forEach((locale) => {
      (['product', 'model'] as const).forEach((mode) => {
        ALL_KINDS.forEach((kind) => {
          const label = imageKindLabel(locale, mode, kind);
          expect(label.trim().length).toBeGreaterThan(1);
          expect(label).not.toMatch(EMOJI_RE);
        });
      });
    });
  });

  // 客户文档原文逐条:
  // 1. ⭐ Main product image / Main model photo
  // 2. 📦 White background photo / Clothing on white background
  // 3. 🏠 Lifestyle photo (product) / 🌆 Lifestyle photo (model)
  // 4. 🔍 Close-up details (product) / 🧵 Fabric close-up (model)
  // 5. 📌 Product details close-up (product) / 🔍 Detail close-up (model)
  it('en 各类图片为干净文案(无 emoji,对齐设计)', () => {
    expect(imageKindLabel('en', 'product', 'selling')).toBe('Main product image');
    expect(imageKindLabel('en', 'product', 'white')).toBe('White background photo');
    expect(imageKindLabel('en', 'product', 'scene')).toBe('Lifestyle photo');
    expect(imageKindLabel('en', 'product', 'closeup')).toBe('Close-up details');
    expect(imageKindLabel('en', 'product', 'closeup_white')).toBe('Product details close-up');
    expect(imageKindLabel('en', 'model', 'selling')).toBe('Main model photo');
  });

  it('ru/kk/zh locale 命名带客户期望的关键词', () => {
    expect(imageKindLabel('ru', 'product', 'selling')).toContain('Главное фото товара');
    expect(imageKindLabel('ru', 'product', 'white')).toContain('Фото на белом фоне');
    expect(imageKindLabel('kk', 'product', 'selling')).toContain('Тауардың негізгі фотосы');
    expect(imageKindLabel('zh', 'model', 'selling')).toContain('模特主图');
    expect(imageKindLabel('zh', 'model', 'closeup')).toContain('面料');
  });

  it('回退到 product 当 mode 不在白名单 (防御性)', () => {
    expect(imageKindLabel('ru', null, 'selling')).toBe(imageKindLabel('ru', 'product', 'selling'));
    expect(imageKindLabel('ru', undefined, 'white')).toBe(imageKindLabel('ru', 'product', 'white'));
  });
});

// 守护客户文档原话 "Preparing photos for Kaspi/WB..." 的动态注入
describe('creatingTask dynamic loading copy', () => {
  it('每个 locale 都把 target 名字注入到 loading 文案里', () => {
    expect(getMessages('ru').creatingTask('Kaspi.kz')).toBe('Готовим фото для Kaspi.kz...');
    expect(getMessages('kk').creatingTask('Kaspi.kz')).toBe('Kaspi.kz үшін сурет дайындалуда...');
    expect(getMessages('en').creatingTask('Wildberries')).toBe('Preparing photos for Wildberries...');
    expect(getMessages('zh').creatingTask('TikTok Shop')).toBe('正在为 TikTok Shop 准备图片...');
  });

  it('Universal 平台用 creatingTaskTargetAll 替代品牌名', () => {
    const locales: SupportedLocale[] = ['ru', 'kk', 'en', 'zh'];
    locales.forEach((locale) => {
      const msg = getMessages(locale);
      const universal = msg.creatingTask(msg.creatingTaskTargetAll);
      expect(universal.length).toBeGreaterThan(0);
      expect(universal).toContain(msg.creatingTaskTargetAll);
    });
  });
});

// 守护 quick-chip 三组 + 客户给的固定数量
describe('quick-chip i18n consistency (客户反馈守护)', () => {
  const locales: SupportedLocale[] = ['ru', 'kk', 'en', 'zh'];

  it('每个 locale 都有 3 个组标签 + 4 类目 + 3 受众 + 4 风格(含 Aman,对齐设计稿)', () => {
    locales.forEach((locale) => {
      const m = getMessages(locale);
      expect(m.quickChipsCategoryLabel.length).toBeGreaterThan(0);
      expect(m.quickChipsAudienceLabel.length).toBeGreaterThan(0);
      expect(m.quickChipsStyleLabel.length).toBeGreaterThan(0);
      expect(m.quickChipsCategories).toHaveLength(4);
      expect(m.quickChipsAudiences).toHaveLength(3);
      expect(m.quickChipsStyles).toHaveLength(4);
      expect(m.quickChipsStyles[0]).toBe('Aman');
    });
  });

  it('Style 组在每个 locale 都包含 Kaspi 和 Wildberries 品牌名 (不翻译)', () => {
    locales.forEach((locale) => {
      const styles = getMessages(locale).quickChipsStyles;
      expect(styles).toContain('Kaspi');
      expect(styles).toContain('Wildberries');
    });
  });
});
