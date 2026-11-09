import type { GenerationProvider } from './types';

const MOCK_RESULT_URLS = [
  '/mock-results/tamga-outdoor-1.svg',
  '/mock-results/tamga-beauty-1.svg',
  '/mock-results/tamga-electronics-1.svg',
  '/mock-results/tamga-home-1.svg'
];

export class MockGenerationProvider implements GenerationProvider {
  async startItem({ item }: Parameters<GenerationProvider['generateItem']>[0]) {
    const url = MOCK_RESULT_URLS[item.index % MOCK_RESULT_URLS.length];
    return { status: 'succeeded' as const, resultUrl: url };
  }

  async syncItem({ item }: Parameters<GenerationProvider['generateItem']>[0]) {
    if (item.resultUrl) {
      return { status: 'succeeded' as const, resultUrl: item.resultUrl };
    }

    const url = MOCK_RESULT_URLS[item.index % MOCK_RESULT_URLS.length];
    return { status: 'succeeded' as const, resultUrl: url };
  }

  async generateItem(input: Parameters<GenerationProvider['generateItem']>[0]) {
    const result = await this.startItem(input);
    if (result.status !== 'succeeded') {
      throw new Error('Mock generation did not complete synchronously.');
    }

    return { resultUrl: result.resultUrl };
  }
}
