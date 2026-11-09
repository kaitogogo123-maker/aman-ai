import type { AspectRatio, ImageKind, OutputLanguage, TargetPlatform } from '@/lib/core/generation/types';

// 选定平台时一次性套用的推荐: 画幅比例、生成语言、图片类型组合
// counts 仅在用户尚未手动调整图片数量时被套用 (见 isCountsAtInitialState)
export type PlatformPreset = {
  ratio: AspectRatio;
  languages: OutputLanguage[];
  counts?: Partial<Record<ImageKind, number>>;
};

export const PLATFORM_PRESETS: Record<TargetPlatform, PlatformPreset> = {
  general: { ratio: '1:1', languages: ['ru'] },
  kaspi: { ratio: '1:1', languages: ['ru', 'kk'], counts: { selling: 1, white: 1 } },
  aman: { ratio: '9:16', languages: ['ru', 'kk'], counts: { white: 1, selling: 1 } },
  wildberries: { ratio: '9:16', languages: ['ru'], counts: { white: 1, scene: 2, closeup: 1 } },
  ozon: { ratio: '9:16', languages: ['ru'], counts: { white: 1, scene: 1, closeup: 1 } },
  tmall: { ratio: '9:16', languages: ['zh'] },
  jd: { ratio: '9:16', languages: ['zh'] },
  amazon: { ratio: '1:1', languages: ['en'], counts: { selling: 1, white: 1 } },
  tiktok: { ratio: '9:16', languages: ['en'], counts: { selling: 1, scene: 1 } },
  shopee: { ratio: '9:16', languages: ['en'] }
};
