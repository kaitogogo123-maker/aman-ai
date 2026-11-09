import { describe, expect, it } from 'vitest';
import { outputLanguageSchema } from '@/lib/core/generation/api-schema';

describe('outputLanguageSchema', () => {
  it('accepts only ru, kk, en, and zh', () => {
    expect(outputLanguageSchema.safeParse('ru').success).toBe(true);
    expect(outputLanguageSchema.safeParse('kk').success).toBe(true);
    expect(outputLanguageSchema.safeParse('en').success).toBe(true);
    expect(outputLanguageSchema.safeParse('zh').success).toBe(true);

    expect(outputLanguageSchema.safeParse('ja').success).toBe(false);
    expect(outputLanguageSchema.safeParse('it').success).toBe(false);
    expect(outputLanguageSchema.safeParse('fr').success).toBe(false);
    expect(outputLanguageSchema.safeParse('es').success).toBe(false);
    expect(outputLanguageSchema.safeParse('de').success).toBe(false);
  });
});
