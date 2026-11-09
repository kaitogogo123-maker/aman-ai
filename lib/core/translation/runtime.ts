import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { MockTranslator } from './mock-translator';
import { QwenMTTranslator } from './qwen-mt-translator';
import type { Translator } from './types';

export function createRuntimeTranslator(runtimeEnv: AppEnv = getRuntimeEnv()): Translator {
  if (runtimeEnv.MOCK_MODE || !runtimeEnv.ALI_DASHSCOPE_KEY) {
    return new MockTranslator();
  }

  return new QwenMTTranslator({
    apiKey: runtimeEnv.ALI_DASHSCOPE_KEY,
    endpoint: runtimeEnv.ALI_DASHSCOPE_ENDPOINT
  });
}
