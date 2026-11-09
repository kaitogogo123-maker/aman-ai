import type { OutputLanguage } from '@/lib/core/generation/types';
import type { TranslateInput, TranslateOutput, Translator } from './types';

type Fetcher = typeof fetch;

export interface QwenMTTranslatorOptions {
  apiKey: string;
  endpoint: string;
  fetcher?: Fetcher;
}

const LANG_CODE_TO_QWEN_NAME: Record<OutputLanguage, string> = {
  ru: 'Russian',
  kk: 'Kazakh',
  en: 'English',
  zh: 'Chinese'
};

export class QwenMTTranslator implements Translator {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetcher: Fetcher;

  constructor(options: QwenMTTranslatorOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint.replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
  }

  static toQwenTargetLanguage(lang: OutputLanguage): string {
    return LANG_CODE_TO_QWEN_NAME[lang];
  }

  async translate(input: TranslateInput): Promise<TranslateOutput> {
    const response = await this.fetcher(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-mt-flash',
        messages: [{ role: 'user', content: input.text }],
        translation_options: {
          source_lang: 'auto',
          target_lang: QwenMTTranslator.toQwenTargetLanguage(input.targetLang)
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Qwen-MT request failed with ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const translated = data.choices?.[0]?.message?.content;

    if (!translated) {
      throw new Error('Qwen-MT response did not include translated content.');
    }

    return {
      translated,
      provider: 'qwen-mt',
      cacheHit: false
    };
  }
}
