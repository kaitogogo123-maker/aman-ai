import { composeProductInfo } from '@/lib/core/analysis/compose-product-info';
import type { ProductAnalysis } from '@/lib/core/analysis/types';
import type { GenerationMode } from '@/lib/core/generation/types';
import type { Translator } from './types';

export async function preparePromptProductInfo(input: {
  productInfo: string;
  analysis?: ProductAnalysis;
  mode?: GenerationMode;
  translator?: Translator;
}) {
  const promptSource = resolvePromptSource(input);
  const effectivePromptSource = promptSource || 'Use the visible product in the uploaded source image as the product reference.';

  if (!shouldTranslateToEnglish(effectivePromptSource) || !input.translator) {
    return effectivePromptSource;
  }

  const result = await input.translator.translate({
    text: effectivePromptSource,
    targetLang: 'en'
  });

  return result.translated.trim() || effectivePromptSource;
}

function shouldTranslateToEnglish(text: string) {
  return /[^\u0000-\u007F]/.test(text);
}

function resolvePromptSource(input: { productInfo: string; analysis?: ProductAnalysis; mode?: GenerationMode }) {
  const rawProductInfo = input.productInfo.trim();
  const structuredProductInfo = input.analysis ? composeProductInfo(input.analysis, input.mode) : '';

  if (structuredProductInfo && rawProductInfo) {
    return `${structuredProductInfo}\n\nOriginal seller input:\n${rawProductInfo}`;
  }

  if (structuredProductInfo) {
    return structuredProductInfo;
  }

  return rawProductInfo;
}
