import { describe, expect, it } from 'vitest';
import {
  nextPrimaryImageIdAfterRemoval,
  orderedSourceImages,
  sourceImagesSignature,
  type LocalSourceImage
} from '@/lib/core/images/source-images';

function image(id: string, name = `${id}.png`): LocalSourceImage {
  return {
    id,
    previewUrl: `blob:${id}`,
    file: new File(['x'], name, {
      type: 'image/png',
      lastModified: id.charCodeAt(0)
    })
  };
}

describe('source image ordering', () => {
  it('puts the selected primary image first and keeps other images as references', () => {
    expect(orderedSourceImages([image('a'), image('b'), image('c')], 'b').map((item) => item.id)).toEqual([
      'b',
      'a',
      'c'
    ]);
  });

  it('falls back to the first image when no primary id is selected', () => {
    expect(orderedSourceImages([image('a'), image('b')], null).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('moves primary selection to the first remaining image when the primary is deleted', () => {
    expect(nextPrimaryImageIdAfterRemoval([image('a'), image('b'), image('c')], 'b', 'b')).toBe('a');
  });

  it('keeps the existing primary when deleting a reference image', () => {
    expect(nextPrimaryImageIdAfterRemoval([image('a'), image('b'), image('c')], 'c', 'b')).toBe('b');
  });

  it('builds a signature from primary-first image order', () => {
    expect(sourceImagesSignature([image('a'), image('b')], 'b')).toBe('b.png:1:98|a.png:1:97');
  });
});
