import type { ProductAnalysis } from '@/lib/core/analysis/types';
import type { GenerationMode, ImageKind } from '@/lib/core/generation/types';
import type { LocalSourceImage } from '@/lib/core/images/source-images';

export const EMPTY_ANALYSIS: ProductAnalysis = {
  productName: '',
  targetAudience: '',
  sellingPoints: '',
  materialDescription: '',
  usageInstructions: '',
  category: ''
};

export type QuickChipGroupKey = 'category' | 'audience' | 'style';

export type QuickChipSelections = Record<QuickChipGroupKey, string[]>;

export interface TamgaModeDraft {
  productInfo: string;
  counts: Record<ImageKind, number>;
  // 用户是否用图片数量 stepper 手动调过 counts。
  // 区别"用户手动编辑"和"前次平台预设套用"——切换 platform 时只有手动编辑过才应阻止重新套用预设。
  hasManualCountEdits: boolean;
  sourceImages: LocalSourceImage[];
  primaryImageId: string | null;
  analysis: ProductAnalysis;
  analysisSourceKey: string | null;
  analysisError: string | null;
  selectedQuickChips: QuickChipSelections;
}

export function createEmptyQuickChipSelections(): QuickChipSelections {
  return { category: [], audience: [], style: [] };
}

// 把 chip 选项拼成结构化前缀附加到 productInfo 顶部, 不污染用户在 textarea 里手写或 AI 填的正文
export function composeProductInfoWithQuickChips(
  productInfo: string,
  selections: QuickChipSelections,
  groupLabels: Record<QuickChipGroupKey, string>
): string {
  const parts: string[] = [];
  (['category', 'audience', 'style'] as const).forEach((key) => {
    const values = selections[key];
    if (values.length > 0) {
      parts.push(`${groupLabels[key]}: ${values.join(', ')}`);
    }
  });
  if (parts.length === 0) {
    return productInfo;
  }
  const prefix = parts.join('. ') + '.';
  const body = productInfo.trim();
  return body ? `${prefix}\n\n${body}` : prefix;
}

export function createDefaultCounts(): Record<ImageKind, number> {
  return {
    selling: 0,
    white: 1,
    scene: 0,
    closeup: 0,
    closeup_white: 0
  };
}


export function createTamgaModeDraft(): TamgaModeDraft {
  return {
    productInfo: '',
    counts: createDefaultCounts(),
    hasManualCountEdits: false,
    sourceImages: [],
    primaryImageId: null,
    analysis: { ...EMPTY_ANALYSIS },
    analysisSourceKey: null,
    analysisError: null,
    selectedQuickChips: createEmptyQuickChipSelections()
  };
}

export function createTamgaModeDrafts(): Record<GenerationMode, TamgaModeDraft> {
  return {
    product: createTamgaModeDraft(),
    model: createTamgaModeDraft()
  };
}

export function updateTamgaModeDraft(
  drafts: Record<GenerationMode, TamgaModeDraft>,
  mode: GenerationMode,
  patch: Partial<TamgaModeDraft> | ((draft: TamgaModeDraft) => Partial<TamgaModeDraft>)
): Record<GenerationMode, TamgaModeDraft> {
  const currentDraft = drafts[mode];
  const nextPatch = typeof patch === 'function' ? patch(currentDraft) : patch;

  return {
    ...drafts,
    [mode]: {
      ...currentDraft,
      ...nextPatch
    }
  };
}
