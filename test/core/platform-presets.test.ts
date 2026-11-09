import { describe, expect, it } from 'vitest';
import { PLATFORM_PRESETS } from '@/lib/core/ui/platform-presets';
import type { AspectRatio, ImageKind, TargetPlatform } from '@/lib/core/generation/types';

// 守护客户反馈里的 marketplace 一键预设: 任何无意改动这些数字都会被这个测试抓到
describe('PLATFORM_PRESETS', () => {
  const ALLOWED_RATIOS: AspectRatio[] = [
    '1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9', '4:5', '5:4', '21:9', '9:21'
  ];
  const ALLOWED_KINDS: ImageKind[] = ['selling', 'white', 'scene', 'closeup', 'closeup_white'];

  it('covers every TargetPlatform code', () => {
    const codes: TargetPlatform[] = [
      'general', 'kaspi', 'aman', 'wildberries', 'ozon', 'tmall', 'jd', 'amazon', 'tiktok', 'shopee'
    ];
    codes.forEach((code) => {
      expect(PLATFORM_PRESETS[code]).toBeDefined();
    });
  });

  it('每个预设的 ratio 都在 AspectRatio 枚举内, languages 至少 1 个', () => {
    Object.values(PLATFORM_PRESETS).forEach((preset) => {
      expect(ALLOWED_RATIOS).toContain(preset.ratio);
      expect(preset.languages.length).toBeGreaterThan(0);
    });
  });

  it('预设的 counts (如果存在) 只引用合法 ImageKind 且非负', () => {
    Object.values(PLATFORM_PRESETS).forEach((preset) => {
      if (!preset.counts) return;
      Object.entries(preset.counts).forEach(([kind, count]) => {
        expect(ALLOWED_KINDS).toContain(kind as ImageKind);
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // 客户文档原话: ⭐ For Kaspi: White background photo ×1, Main photo ×1
  it('Kaspi 预设给 selling=1 white=1 + 1:1 比例', () => {
    expect(PLATFORM_PRESETS.kaspi.counts).toEqual({ selling: 1, white: 1 });
    expect(PLATFORM_PRESETS.kaspi.ratio).toBe('1:1');
    expect(PLATFORM_PRESETS.kaspi.languages).toEqual(['ru', 'kk']);
  });

  // 客户文档原话: ⭐ For Wildberries: White background ×1, Lifestyle ×2, Details ×1
  it('Wildberries 预设给 white=1 scene=2 closeup=1 + 9:16 比例', () => {
    expect(PLATFORM_PRESETS.wildberries.counts).toEqual({ white: 1, scene: 2, closeup: 1 });
    expect(PLATFORM_PRESETS.wildberries.ratio).toBe('9:16');
  });

  // 客户文档原话: ⭐ For TikTok / Instagram: 9:16 format, Model photos, Lifestyle images
  it('TikTok 预设给 selling=1 scene=1 + 9:16 比例', () => {
    expect(PLATFORM_PRESETS.tiktok.counts).toEqual({ selling: 1, scene: 1 });
    expect(PLATFORM_PRESETS.tiktok.ratio).toBe('9:16');
  });

  it('general (Universal) 没有 counts 预设 (用户自己挑)', () => {
    expect(PLATFORM_PRESETS.general.counts).toBeUndefined();
  });
});
