import type { GenerationSettings, GenerationSettingsInput, ImageTypeCount } from './types';

// 单一真源:前端步进器上限、api-schema、服务端校验都引用这两个常量,改一处即全一致。
export const MAX_PER_TYPE = 16;
export const MAX_PER_BATCH = 40;

export function normalizeGenerationSettings(input: GenerationSettingsInput): GenerationSettings {
  const imageTypes = normalizeImageTypes(input.imageTypes);
  const totalImages = imageTypes.reduce((sum, type) => sum + type.count, 0);

  if (totalImages < 1) {
    throw new Error('A generation batch must include at least 1 image.');
  }

  if (totalImages > MAX_PER_BATCH) {
    throw new Error(`A generation batch cannot exceed ${MAX_PER_BATCH} images.`);
  }

  return {
    ...input,
    mode: input.mode ?? 'product',
    platform: input.platform ?? 'general',
    productInfo: input.productInfo.trim(),
    imageTypes,
    totalImages
  };
}

function normalizeImageTypes(imageTypes: ImageTypeCount[]): ImageTypeCount[] {
  return imageTypes
    .map((type) => ({
      kind: type.kind,
      count: Math.min(Math.max(Math.trunc(type.count), 0), MAX_PER_TYPE)
    }))
    .filter((type) => type.count > 0);
}
