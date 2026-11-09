import type { ProductAnalysis } from './types';
import type { GenerationMode } from '@/lib/core/generation/types';

export function composeProductInfo(analysis: ProductAnalysis, mode: GenerationMode = 'product'): string {
  const labels =
    mode === 'model'
      ? [
          ['Apparel Profile', analysis.productName],
          ['Construction Details', analysis.targetAudience],
          ['Functional Benefits', analysis.sellingPoints],
          ['Styling Plan', analysis.materialDescription],
          ['Core Marketing Points', analysis.usageInstructions],
          ['Apparel Category', analysis.category]
        ]
      : [
          ['Product Name', analysis.productName],
          ['Target Audience', analysis.targetAudience],
          ['Selling Points', analysis.sellingPoints],
          ['Material Description', analysis.materialDescription],
          ['Usage Instructions', analysis.usageInstructions],
          ['Product Category', analysis.category]
        ];

  return labels
    .map(([label, value]) => {
      const normalizedValue = normalizePromptField(value);
      if (!normalizedValue) {
        return null;
      }

      return `[${label}]: ${normalizedValue}`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

function normalizePromptField(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
