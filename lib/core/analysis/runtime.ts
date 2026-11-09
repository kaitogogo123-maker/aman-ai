import { getRuntimeEnv, type AppEnv } from '@/lib/config/env';
import { createR2AwareFetcher } from '@/lib/core/storage/r2-binding-fetcher';
import type { ProductAnalyzer } from './types';
import { MockProductAnalyzer } from './mock-analyzer';
import { QwenVisualAnalyzer } from './qwen-visual-analyzer';

export function createRuntimeProductAnalyzer(
  runtimeEnv: AppEnv = getRuntimeEnv()
): ProductAnalyzer {
  if (runtimeEnv.MOCK_MODE || !runtimeEnv.ALI_DASHSCOPE_KEY) {
    return new MockProductAnalyzer();
  }

  return new QwenVisualAnalyzer({
    apiKey: runtimeEnv.ALI_DASHSCOPE_KEY,
    endpoint: runtimeEnv.ALI_DASHSCOPE_ENDPOINT,
    textModel: runtimeEnv.ALI_DASHSCOPE_ANALYSIS_TEXT_MODEL ?? 'qwen3.5-plus',
    visionModel: runtimeEnv.ALI_DASHSCOPE_ANALYSIS_VISION_MODEL ?? 'qwen3-vl-plus',
    fetcher: createR2AwareFetcher()
  });
}
