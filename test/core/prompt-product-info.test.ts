import { describe, expect, it, vi } from 'vitest';
import { preparePromptProductInfo } from '@/lib/core/translation/prompt-product-info';

const analysis = {
  productName: '空气净化器',
  targetAudience: '卧室和桌面用户',
  sellingPoints: '低噪音，HEPA 过滤',
  materialDescription: '白色 ABS 机身',
  usageInstructions: '轻触按钮即可启动',
  category: 'Home Appliances > Air Purifiers'
};

describe('preparePromptProductInfo', () => {
  it('uses raw product info as-is when translation is not needed', async () => {
    await expect(
      preparePromptProductInfo({
        productInfo: 'Portable air purifier for bedrooms and desks.'
      })
    ).resolves.toBe('Portable air purifier for bedrooms and desks.');
  });

  it('combines structured analysis with the raw seller input before translation', async () => {
    const translate = vi.fn(async () => ({
      translated: 'English prompt block.',
      provider: 'qwen-mt' as const,
      cacheHit: false
    }));

    const result = await preparePromptProductInfo({
      productInfo: '用户原始补充说明',
      analysis,
      translator: { translate }
    });

    expect(result).toBe('English prompt block.');
    expect(translate).toHaveBeenCalledWith({
      text: [
        '[Product Name]: 空气净化器',
        '[Target Audience]: 卧室和桌面用户',
        '[Selling Points]: 低噪音，HEPA 过滤',
        '[Material Description]: 白色 ABS 机身',
        '[Usage Instructions]: 轻触按钮即可启动',
        '[Product Category]: Home Appliances > Air Purifiers',
        '',
        'Original seller input:',
        '用户原始补充说明'
      ].join('\n'),
      targetLang: 'en'
    });
  });

  it('falls back to structured analysis alone when raw seller input is blank', async () => {
    const translate = vi.fn(async () => ({
      translated: 'English prompt block.',
      provider: 'qwen-mt' as const,
      cacheHit: false
    }));

    await preparePromptProductInfo({
      productInfo: '   ',
      analysis,
      translator: { translate }
    });

    expect(translate).toHaveBeenCalledWith({
      text: [
        '[Product Name]: 空气净化器',
        '[Target Audience]: 卧室和桌面用户',
        '[Selling Points]: 低噪音，HEPA 过滤',
        '[Material Description]: 白色 ABS 机身',
        '[Usage Instructions]: 轻触按钮即可启动',
        '[Product Category]: Home Appliances > Air Purifiers'
      ].join('\n'),
      targetLang: 'en'
    });
  });

  it('uses apparel-specific structured labels for model image mode', async () => {
    const translate = vi.fn(async () => ({
      translated: 'English apparel prompt block.',
      provider: 'qwen-mt' as const,
      cacheHit: false
    }));

    await preparePromptProductInfo({
      productInfo: '男士户外机能工装裤',
      analysis: {
        productName: '男士户外机能工装裤',
        targetAudience: '高强度尼龙，DWR 防泼水',
        sellingPoints: '透气防水，活动灵活',
        materialDescription: '户外徒步和城市通勤穿搭',
        usageInstructions: '突出面料、版型和核心卖点',
        category: 'Clothing > Men > Pants'
      },
      mode: 'model',
      translator: { translate }
    });

    expect(translate).toHaveBeenCalledWith({
      text: expect.stringContaining('[Apparel Profile]: 男士户外机能工装裤'),
      targetLang: 'en'
    });
  });
});
