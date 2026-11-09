import { describe, expect, it } from 'vitest';
import { normalizeGenerationSettings } from '@/lib/core/generation/settings';

describe('normalizeGenerationSettings', () => {
  it('keeps positive counts and removes zero-count image types', () => {
    const settings = normalizeGenerationSettings({
      productInfo: 'Waterproof outdoor tent',
      model: 'nano-banana-2',
      resolution: '2k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [
        { kind: 'selling', count: 2 },
        { kind: 'scene', count: 0 }
      ]
    });

    expect(settings.imageTypes).toEqual([{ kind: 'selling', count: 2 }]);
    expect(settings.totalImages).toBe(2);
  });

  it('caps each image type at 16 images', () => {
    const settings = normalizeGenerationSettings({
      productInfo: 'Waterproof outdoor tent',
      model: 'nano-banana-2',
      resolution: '2k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 20 }]
    });

    expect(settings.imageTypes).toEqual([{ kind: 'selling', count: 16 }]);
    expect(settings.totalImages).toBe(16);
  });

  it('rejects batches above 40 images', () => {
    expect(() =>
      normalizeGenerationSettings({
        productInfo: 'Waterproof outdoor tent',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [
          { kind: 'selling', count: 16 },
          { kind: 'scene', count: 16 },
          { kind: 'white', count: 16 }
        ]
      })
    ).toThrow('A generation batch cannot exceed 40 images.');
  });

  it('keeps the selected fal model', () => {
    const settings = normalizeGenerationSettings({
      productInfo: 'Waterproof outdoor tent',
      model: 'nano-banana-pro',
      resolution: '2k',
      aspectRatio: '1:1',
      outputLanguage: 'ru',
      fontStyle: 'auto',
      imageTypes: [{ kind: 'selling', count: 1 }]
    });

    expect(settings.model).toBe('nano-banana-pro');
  });
});
