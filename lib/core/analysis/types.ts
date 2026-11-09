import type { SupportedLocale } from '@/lib/i18n';
import type { GenerationMode } from '@/lib/core/generation/types';

export interface ProductAnalysis {
  productName: string;
  targetAudience: string;
  sellingPoints: string;
  materialDescription: string;
  usageInstructions: string;
  category: string;
}

export interface AnalyzeProductInput {
  sourceImageUrl?: string;
  sourceImageUrls?: string[];
  productInfoRaw: string;
  locale: SupportedLocale;
  mode?: GenerationMode;
}

export interface ProductAnalyzer {
  analyze(input: AnalyzeProductInput): Promise<ProductAnalysis>;
}
