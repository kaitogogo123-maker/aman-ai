import { describe, expect, it } from 'vitest';
import { composeProductInfo } from '@/lib/core/analysis/compose-product-info';
import {
  analyzeProductRequestSchema,
  generateRequestSchema
} from '@/lib/core/generation/api-schema';

describe('composeProductInfo', () => {
  it('builds a stable prompt block from structured analysis fields', () => {
    expect(
      composeProductInfo({
        productName: '  空气净化器  ',
        targetAudience: '卧室与\n\n桌面用户',
        sellingPoints: '低噪音；  360°进风',
        materialDescription: '白色\nABS   外壳',
        usageInstructions: '轻触电源\t启动',
        category: ' Home Appliances  >\nAir Purifiers '
      })
    ).toBe(
      [
        '[Product Name]: 空气净化器',
        '[Target Audience]: 卧室与 桌面用户',
        '[Selling Points]: 低噪音； 360°进风',
        '[Material Description]: 白色 ABS 外壳',
        '[Usage Instructions]: 轻触电源 启动',
        '[Product Category]: Home Appliances > Air Purifiers'
      ].join('\n')
    );
  });

  it('omits empty and whitespace-only fields cleanly', () => {
    expect(
      composeProductInfo({
        productName: '  空气净化器  ',
        targetAudience: '   ',
        sellingPoints: '\n\t',
        materialDescription: ' 白色 ABS 外壳 ',
        usageInstructions: '',
        category: '  Home Appliances  '
      })
    ).toBe(
      [
        '[Product Name]: 空气净化器',
        '[Material Description]: 白色 ABS 外壳',
        '[Product Category]: Home Appliances'
      ].join('\n')
    );
  });

  it('uses apparel model-image labels for model mode prompts', () => {
    expect(
      composeProductInfo(
        {
          productName: '男士户外机能工装裤',
          targetAudience: '高强度尼龙，DWR 防泼水',
          sellingPoints: '透气防水，活动灵活',
          materialDescription: '户外徒步和城市通勤穿搭',
          usageInstructions: '突出面料、版型和核心卖点',
          category: 'Clothing > Men > Pants'
        },
        'model'
      )
    ).toBe(
      [
        '[Apparel Profile]: 男士户外机能工装裤',
        '[Construction Details]: 高强度尼龙，DWR 防泼水',
        '[Functional Benefits]: 透气防水，活动灵活',
        '[Styling Plan]: 户外徒步和城市通勤穿搭',
        '[Core Marketing Points]: 突出面料、版型和核心卖点',
        '[Apparel Category]: Clothing > Men > Pants'
      ].join('\n')
    );
  });
});

describe('Task 1 schemas', () => {
  it('parses structured analysis through generateRequestSchema', () => {
    const parsed = generateRequestSchema.parse({
      sourceImageUrl: '/mock-results/source-product.svg',
      productInfo: 'Original raw product info',
      analysis: {
        productName: '  空气净化器  ',
        targetAudience: ' 卧室用户 ',
        sellingPoints: ' 低噪音 ',
        materialDescription: ' 白色 ABS 外壳 ',
        usageInstructions: ' 轻触电源启动 ',
        category: ' Home Appliances > Air Purifiers '
      },
      model: 'nano-banana-2',
      resolution: '2k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 1 }]
    });

    expect(parsed.analysis).toEqual({
      productName: '空气净化器',
      targetAudience: '卧室用户',
      sellingPoints: '低噪音',
      materialDescription: '白色 ABS 外壳',
      usageInstructions: '轻触电源启动',
      category: 'Home Appliances > Air Purifiers'
    });
    expect(parsed.mode).toBe('product');
  });

  it('defaults API generation requests to the mobile-first 9:16 aspect ratio', () => {
    const parsed = generateRequestSchema.parse({
      sourceImageUrl: '/mock-results/source-product.svg',
      productInfo: 'Original raw product info',
      model: 'nano-banana-2',
      resolution: '2k',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 1 }]
    });

    expect(parsed.aspectRatio).toBe('9:16');
  });

  it('parses model-image mode through generateRequestSchema and analyzeProductRequestSchema', () => {
    expect(
      generateRequestSchema.parse({
        sourceImageUrl: '/mock-results/source-product.svg',
        mode: 'model',
        productInfo: '男士户外机能工装裤',
        model: 'nano-banana-pro',
        resolution: '2k',
        aspectRatio: '9:16',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).mode
    ).toBe('model');

    expect(
      analyzeProductRequestSchema.parse({
        sourceImageUrl: 'https://example.com/pants.png',
        productInfoRaw: '男士户外机能工装裤',
        mode: 'model',
        locale: 'zh'
      }).mode
    ).toBe('model');
  });

  it('accepts ordered source image urls for multi-image generation', () => {
    const parsed = generateRequestSchema.parse({
      sourceImageUrls: [
        'https://example.com/primary.png',
        'https://example.com/reference-1.png',
        'https://example.com/reference-2.png'
      ],
      productInfo: 'Original raw product info',
      model: 'nano-banana-2',
      resolution: '2k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 1 }]
    });

    expect(parsed.sourceImageUrl).toBe('https://example.com/primary.png');
    expect(parsed.sourceImageUrls).toEqual([
      'https://example.com/primary.png',
      'https://example.com/reference-1.png',
      'https://example.com/reference-2.png'
    ]);
  });

  it('rejects more than six ordered source images', () => {
    expect(
      generateRequestSchema.safeParse({
        sourceImageUrls: [
          'https://example.com/1.png',
          'https://example.com/2.png',
          'https://example.com/3.png',
          'https://example.com/4.png',
          'https://example.com/5.png',
          'https://example.com/6.png',
          'https://example.com/7.png'
        ],
        productInfo: 'Original raw product info',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).success
    ).toBe(false);
  });

  it('accepts six ordered source images for model-image mode', () => {
    const parsed = generateRequestSchema.parse({
      sourceImageUrls: [
        'https://example.com/1.png',
        'https://example.com/2.png',
        'https://example.com/3.png',
        'https://example.com/4.png',
        'https://example.com/5.png',
        'https://example.com/6.png'
      ],
      mode: 'model',
      productInfo: '男士户外机能工装裤',
      model: 'nano-banana-2',
      resolution: '2k',
      aspectRatio: '9:16',
      outputLanguage: 'zh',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 1 }]
    });

    expect(parsed.sourceImageUrls).toHaveLength(6);
  });

  it('rejects six ordered source images for product-image mode', () => {
    expect(
      generateRequestSchema.safeParse({
        sourceImageUrls: [
          'https://example.com/1.png',
          'https://example.com/2.png',
          'https://example.com/3.png',
          'https://example.com/4.png',
          'https://example.com/5.png',
          'https://example.com/6.png'
        ],
        mode: 'product',
        productInfo: 'Original raw product info',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).success
    ).toBe(false);
  });

  it('lets partially populated analysis flow through composeProductInfo without blank sections', () => {
    const parsed = generateRequestSchema.parse({
      sourceImageUrl: '/mock-results/source-product.svg',
      productInfo: 'Original raw product info',
      analysis: {
        productName: '  空气净化器  ',
        materialDescription: ' 白色 ABS 外壳 '
      },
      model: 'nano-banana-2',
      resolution: '2k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 1 }]
    });

    expect(composeProductInfo(parsed.analysis!)).toBe(
      ['[Product Name]: 空气净化器', '[Material Description]: 白色 ABS 外壳'].join('\n')
    );
  });

  it('parses analyzeProductRequestSchema with defaults and trimmed text', () => {
    expect(
      analyzeProductRequestSchema.parse({
        productInfoRaw: '  原始商品信息  '
      })
    ).toEqual({
      productInfoRaw: '原始商品信息',
      locale: 'ru',
      mode: 'product'
    });
  });

  it('accepts ordered source image urls for product analysis', () => {
    expect(
      analyzeProductRequestSchema.parse({
        sourceImageUrls: [
          'https://example.com/primary.png',
          'https://example.com/reference.png'
        ],
        productInfoRaw: '  原始商品信息  ',
        locale: 'zh'
      })
    ).toEqual({
      sourceImageUrl: 'https://example.com/primary.png',
      sourceImageUrls: [
        'https://example.com/primary.png',
        'https://example.com/reference.png'
      ],
      productInfoRaw: '原始商品信息',
      locale: 'zh',
      mode: 'product'
    });
  });

  it('rejects an empty analyze request without image or raw product info', () => {
    expect(analyzeProductRequestSchema.safeParse({}).success).toBe(false);
    expect(analyzeProductRequestSchema.safeParse({ productInfoRaw: ' \n\t ' }).success).toBe(false);
    expect(
      analyzeProductRequestSchema.safeParse({
        sourceImageUrl: 'https://example.com/product.jpg',
        productInfoRaw: ' \n\t '
      }).success
    ).toBe(true);
  });

  it('treats blank analyze sourceImageUrl as missing when raw product info is present', () => {
    expect(
      analyzeProductRequestSchema.parse({
        sourceImageUrl: ' \n\t ',
        productInfoRaw: '  原始商品信息  '
      })
    ).toEqual({
      productInfoRaw: '原始商品信息',
      locale: 'ru',
      mode: 'product'
    });
  });

  it('rejects blank sourceImageUrl in generateRequestSchema', () => {
    expect(
      generateRequestSchema.safeParse({
        sourceImageUrl: ' \n\t ',
        productInfo: 'Original raw product info',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).success
    ).toBe(false);
  });

  it('rejects omitted sourceImageUrl in generateRequestSchema', () => {
    expect(
      generateRequestSchema.safeParse({
        productInfo: 'Original raw product info',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).success
    ).toBe(false);
  });

  it('rejects generate requests whose total image count is zero', () => {
    expect(
      generateRequestSchema.safeParse({
        sourceImageUrl: '/mock-results/source-product.svg',
        productInfo: 'Original raw product info',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 0 }]
      }).success
    ).toBe(false);
  });

  it('accepts blank raw product info when structured analysis is present', () => {
    expect(
      generateRequestSchema.safeParse({
        sourceImageUrl: '/mock-results/source-product.svg',
        productInfo: '   ',
        analysis: {
          productName: '空气净化器',
          targetAudience: '卧室用户'
        },
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).success
    ).toBe(true);
  });

  it('accepts generate requests with only a source image when product info and structured analysis are empty', () => {
    expect(
      generateRequestSchema.safeParse({
        sourceImageUrl: '/mock-results/source-product.svg',
        productInfo: '   ',
        analysis: {
          productName: '   ',
          targetAudience: '\n',
          sellingPoints: ' ',
          materialDescription: ' ',
          usageInstructions: ' ',
          category: ' '
        },
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }).success
    ).toBe(true);
  });
});
