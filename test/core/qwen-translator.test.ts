import { describe, expect, it, vi } from 'vitest';
import { QwenMTTranslator } from '@/lib/core/translation/qwen-mt-translator';

describe('QwenMTTranslator', () => {
  it('calls DashScope compatible endpoint with Qwen-MT options', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Водонепроницаемая палатка' } }]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    const translator = new QwenMTTranslator({
      apiKey: 'dash_test_key',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      fetcher: fetchMock
    });

    const result = await translator.translate({
      text: '防水帐篷',
      targetLang: 'ru'
    });

    expect(result).toEqual({
      translated: 'Водонепроницаемая палатка',
      provider: 'qwen-mt',
      cacheHit: false
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer dash_test_key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-mt-flash',
          messages: [{ role: 'user', content: '防水帐篷' }],
          translation_options: {
            source_lang: 'auto',
            target_lang: 'Russian'
          }
        })
      })
    );
  });

  it('maps supported output language codes to Qwen target names', () => {
    expect(QwenMTTranslator.toQwenTargetLanguage('kk')).toBe('Kazakh');
    expect(QwenMTTranslator.toQwenTargetLanguage('zh')).toBe('Chinese');
    expect(QwenMTTranslator.toQwenTargetLanguage('en')).toBe('English');
  });

  it('throws a readable error when DashScope returns a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => new Response('quota exceeded', { status: 429 }));
    const translator = new QwenMTTranslator({
      apiKey: 'dash_test_key',
      endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      fetcher: fetchMock
    });

    await expect(
      translator.translate({
        text: '防水帐篷',
        targetLang: 'ru'
      })
    ).rejects.toThrow('Qwen-MT request failed with 429: quota exceeded');
  });
});
