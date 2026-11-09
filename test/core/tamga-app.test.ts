import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: unknown; href: string; className?: string }) =>
    createElement('a', { href, className }, children)
}));

vi.mock('@/components/locale-switcher', () => ({
  LocaleSwitcher: ({ locale }: { locale: string }) => createElement('span', null, locale)
}));

import { TamgaApp } from '@/components/tamga-app';

describe('TamgaApp', () => {
  it('renders lightweight AI analysis and localized controls in Chinese', () => {
    const html = renderToStaticMarkup(createElement(TamgaApp, { locale: 'zh' }));

    expect(html).toContain('AI 帮我填写');
    expect(html).toContain('商品图');
    expect(html).toContain('模特图');
    expect(html).toContain('product-info-editor');
    expect(html).toContain('示例：女款白色运动鞋');
    expect(html).toContain('点击上传商品图');
    expect(html).toContain('更多比例');
    expect(html).toContain('analysis-inline-button');
    expect(html).toContain('AI 会根据图片和文字整理商品信息');
    expect(html).toContain('上传最多 5 张商品图');
    // Default counts (white=1) don't need text; language/font chips hidden
    expect(html).not.toContain('生成图片文字语言');
    expect(html).not.toContain('字体风格');
    // 版本选择器按 Aman AI 设计稿移除（model 逻辑保留，默认 nano-banana-2）
    expect(html).not.toContain('版本选择');
    expect(html).not.toContain('version-dropdown');
    expect(html).not.toContain('version-selected');
    // 字体风格 chip is hidden because default counts (white=1) have no text
    expect(html).toContain('9:16');
    expect(html).not.toContain('21:9');
    expect(html).not.toContain('Waterproof outdoor tent');
    expect(html).not.toContain('Nano Banana');
    expect(html).not.toContain('product-info-clear');
  });

  it('does not duplicate the selected product preview in the settings area', () => {
    const html = renderToStaticMarkup(createElement(TamgaApp, { locale: 'zh' }));

    expect(html.match(/点击上传商品图/g)).toHaveLength(1);
  });

  it('keeps generation controls in the right settings area on desktop', () => {
    const html = renderToStaticMarkup(createElement(TamgaApp, { locale: 'zh' }));

    expect(html).toContain('generation-settings');
    expect(html).toMatch(/generation-settings[\s\S]*分辨率[\s\S]*图片类型/);
  });

  it('renders localized font style labels and AI analysis action in English', () => {
    const html = renderToStaticMarkup(createElement(TamgaApp, { locale: 'en' }));

    expect(html).toContain('AI will fill it for me');
    expect(html).toContain('Example: White women');
    expect(html).toContain('Click to upload');
    expect(html).toContain('More ratios');
    // 版本选择器按设计稿移除
    expect(html).not.toContain('Version selection');
    expect(html).not.toContain('version-dropdown');
    expect(html).toContain('analysis-inline-button');
    expect(html).toContain('AI fills a clean product brief from your images and text.');
    expect(html).toContain('Upload up to 5 product photos');
    // Default counts (white=1) don't need text; font style chip hidden
    expect(html).not.toContain('Font style');
    expect(html).not.toContain('Modern Clean');
    expect(html).not.toContain('Product name');
    // "Target audience" is now a legitimate quick-chip group label per customer feedback
    expect(html).not.toContain('Waterproof outdoor tent');
    expect(html).not.toContain('21:9');
  });

  it('renders model image mode with apparel-specific copy and examples', () => {
    const html = renderToStaticMarkup(createElement(TamgaApp, { locale: 'zh', initialMode: 'model' }));

    expect(html).toContain('服装图片');
    expect(html).not.toContain('多角度服装图和搭配参考');
    expect(html).toContain('上传最多 6 张照片');
    expect(html).toContain('示例：女款宽松卫衣');
    expect(html).toContain('AI 会按基础档案、工艺细节、功能性、穿搭方案和核心营销卖点整理服装信息');
    expect(html).toContain('查看服装信息示例');
    expect(html).toContain('AI 自动填写说明');
    expect(html).toContain('field-help-button');
    expect(html).toContain('模特主图');
    expect(html).toContain('穿搭场景');
  });

  it('renders the reduced ratio set and upload placeholder in Russian and Kazakh', () => {
    const russianHtml = renderToStaticMarkup(createElement(TamgaApp, { locale: 'ru' }));
    const kazakhHtml = renderToStaticMarkup(createElement(TamgaApp, { locale: 'kk' }));

    expect(russianHtml).toContain('Нажмите, чтобы загрузить');
    expect(russianHtml).toContain('Пример: Белые женские кроссовки');
    expect(russianHtml).toContain('9:16');
    expect(russianHtml).not.toContain('21:9');
    expect(russianHtml).not.toContain('Стиль шрифта');
    // Simplified locale: ratio "more" button hidden; Tmall/JD hidden
    expect(russianHtml).not.toContain('Tmall');
    expect(russianHtml).not.toContain('JD.com');

    expect(kazakhHtml).toContain('Жүктеу үшін басыңыз');
    expect(kazakhHtml).toContain('Мысалы: Ақ түсті әйелдер кроссовкасы');
    expect(kazakhHtml).toContain('9:16');
    expect(kazakhHtml).not.toContain('21:9');
    expect(kazakhHtml).not.toContain('Қаріп стилі');
    expect(kazakhHtml).not.toContain('Tmall');
    expect(kazakhHtml).not.toContain('JD.com');
  });
});
