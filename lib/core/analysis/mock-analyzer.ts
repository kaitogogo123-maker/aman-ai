import type { AnalyzeProductInput, ProductAnalysis, ProductAnalyzer } from './types';

export class MockProductAnalyzer implements ProductAnalyzer {
  async analyze(input: AnalyzeProductInput): Promise<ProductAnalysis> {
    const hasRawInfo = input.productInfoRaw.trim().length > 0;

    return {
      productName: hasRawInfo ? 'Mock product from text' : 'Mock product from image',
      targetAudience: 'General ecommerce shoppers',
      sellingPoints: 'Clear product silhouette; simple editable claims; deterministic mock output',
      materialDescription: 'Mock mode does not inspect actual materials',
      usageInstructions: 'Review and edit these fields before generation',
      category: hasRawInfo ? 'Mock > Text Guided Product' : 'Mock > Image Guided Product'
    };
  }
}
