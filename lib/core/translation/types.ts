import type { OutputLanguage } from '@/lib/core/generation/types';

export interface TranslateInput {
  text: string;
  targetLang: OutputLanguage;
}

export interface TranslateOutput {
  translated: string;
  provider: 'mock' | 'qwen-mt';
  cacheHit: boolean;
}

export interface Translator {
  translate(input: TranslateInput): Promise<TranslateOutput>;
}
