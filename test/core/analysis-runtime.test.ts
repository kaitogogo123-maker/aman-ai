import { describe, expect, it } from 'vitest';
import { createRuntimeProductAnalyzer } from '@/lib/core/analysis/runtime';
import { MockProductAnalyzer } from '@/lib/core/analysis/mock-analyzer';
import { QwenVisualAnalyzer } from '@/lib/core/analysis/qwen-visual-analyzer';

describe('createRuntimeProductAnalyzer', () => {
  it('uses the mock analyzer in mock mode', () => {
    expect(
      createRuntimeProductAnalyzer({
        MOCK_MODE: true,
        ALI_DASHSCOPE_KEY: 'sk',
        ALI_DASHSCOPE_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      })
    ).toBeInstanceOf(MockProductAnalyzer);
  });

  it('uses the mock analyzer when the DashScope key is missing', () => {
    expect(
      createRuntimeProductAnalyzer({
        MOCK_MODE: false,
        ALI_DASHSCOPE_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      })
    ).toBeInstanceOf(MockProductAnalyzer);
  });

  it('uses QwenVisualAnalyzer with Qwen 3.5 Plus for text and Qwen VL for vision analysis by default', () => {
    const analyzer = createRuntimeProductAnalyzer({
      MOCK_MODE: false,
      ALI_DASHSCOPE_KEY: 'sk',
      ALI_DASHSCOPE_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
    });

    expect(analyzer).toBeInstanceOf(QwenVisualAnalyzer);
    expect((analyzer as { textModel: string }).textModel).toBe('qwen3.5-plus');
    expect((analyzer as { visionModel: string }).visionModel).toBe('qwen3-vl-plus');
  });

  it('allows the DashScope analysis models to be configured', () => {
    const analyzer = createRuntimeProductAnalyzer({
      MOCK_MODE: false,
      ALI_DASHSCOPE_KEY: 'sk',
      ALI_DASHSCOPE_ENDPOINT: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      ALI_DASHSCOPE_ANALYSIS_TEXT_MODEL: 'qwen3.6-plus',
      ALI_DASHSCOPE_ANALYSIS_VISION_MODEL: 'qwen3-vl-plus-latest'
    });

    expect(analyzer).toBeInstanceOf(QwenVisualAnalyzer);
    expect((analyzer as { textModel: string }).textModel).toBe('qwen3.6-plus');
    expect((analyzer as { visionModel: string }).visionModel).toBe('qwen3-vl-plus-latest');
  });
});
