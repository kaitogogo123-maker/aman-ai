import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { MAX_PER_TYPE } from './settings';

function preprocessBlankStringToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export const imageKindSchema = z.enum(['selling', 'white', 'scene', 'closeup', 'closeup_white']);
export const resolutionSchema = z.enum(['1k', '2k', '4k']);
export const aspectRatioSchema = z.enum([
  '1:1',
  '3:4',
  '4:3',
  '2:3',
  '3:2',
  '9:16',
  '16:9',
  '4:5',
  '5:4',
  '21:9',
  '9:21'
]);
export const outputLanguageSchema = z.enum(SUPPORTED_LOCALES);
export const generationModelSchema = z.enum(['nano-banana-2', 'nano-banana-pro', 'gpt-image-pro']);
export const generationModeSchema = z.enum(['product', 'model']);
export const targetPlatformSchema = z.enum([
  'general',
  'kaspi',
  'aman',
  'wildberries',
  'ozon',
  'tmall',
  'jd',
  'amazon',
  'tiktok',
  'shopee'
]);
export const fontStyleSchema = z.enum(['auto', 'geometric_sans', 'bold_sans', 'elegant_serif']);
const optionalSourceImageUrlSchema = z.preprocess(
  preprocessBlankStringToUndefined,
  z.string().trim().min(1).optional()
);
const requiredSourceImageUrlSchema = z.preprocess(
  preprocessBlankStringToUndefined,
  z.string().trim().min(1)
);
const sourceImageUrlsSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .max(6)
  .transform((urls) => Array.from(new Set(urls)));
export const productAnalysisSchema = z.object({
  productName: z.string().trim().max(300).default(''),
  targetAudience: z.string().trim().max(1200).default(''),
  sellingPoints: z.string().trim().max(2500).default(''),
  materialDescription: z.string().trim().max(2500).default(''),
  usageInstructions: z.string().trim().max(2500).default(''),
  category: z.string().trim().max(500).default('')
});

export const analyzeProductRequestSchema = z.preprocess(
  normalizeSourceImages,
  z.object({
    sourceImageUrl: optionalSourceImageUrlSchema,
    sourceImageUrls: sourceImageUrlsSchema.optional(),
    productInfoRaw: z.string().trim().max(4000).default(''),
    locale: outputLanguageSchema.default('ru'),
    mode: generationModeSchema.default('product')
  })
    .superRefine(validateSourceImageLimit)
    .refine((value) => Boolean(value.sourceImageUrl || value.productInfoRaw), {
      message: 'Provide a product image or raw product information first.'
    })
);

export const generateRequestSchema = z.preprocess(
  normalizeSourceImages,
  z.object({
    sourceImageUrl: requiredSourceImageUrlSchema,
    sourceImageUrls: sourceImageUrlsSchema.optional(),
    mode: generationModeSchema.default('product'),
    platform: targetPlatformSchema.default('general'),
    category: z.string().trim().max(60).optional(),
    productInfo: z.string().trim().max(2500).default(''),
    analysis: productAnalysisSchema.optional(),
    model: generationModelSchema.default('nano-banana-2'),
    resolution: resolutionSchema.default('2k'),
    aspectRatio: aspectRatioSchema.default('9:16'),
    outputLanguage: outputLanguageSchema.default('ru'),
    fontStyle: fontStyleSchema.default('auto'),
    // 多语言提交时本次整单的总产出张数(= 单语言张数 × 语言数),用于「≥5 张 300₸/张」折扣
    // 按"整单总产出"判定而非单批;单语言/省略时按本批张数。上限 16×4 语言。
    batchTotalImages: z.coerce.number().int().min(1).max(64).optional(),
    imageTypes: z
      .array(
        z.object({
          kind: imageKindSchema,
          count: z.coerce.number().int().min(0).max(MAX_PER_TYPE)
        })
      )
      .min(1)
      .refine((imageTypes) => imageTypes.some((imageType) => imageType.count > 0), {
        message: 'At least one image must be requested'
      })
  })
    .superRefine(validateSourceImageLimit)
);

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1).max(2500),
  targetLang: outputLanguageSchema.default('ru')
});

function normalizeSourceImages(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const input = { ...(value as Record<string, unknown>) };
  const sourceImageUrls = Array.isArray(input.sourceImageUrls)
    ? input.sourceImageUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : undefined;
  const sourceImageUrl =
    typeof input.sourceImageUrl === 'string' && input.sourceImageUrl.trim().length > 0
      ? input.sourceImageUrl.trim()
      : sourceImageUrls?.[0];

  if (sourceImageUrls && sourceImageUrls.length > 0) {
    input.sourceImageUrls = sourceImageUrls;
  }

  if (sourceImageUrl) {
    input.sourceImageUrl = sourceImageUrl;
  }

  return input;
}

function validateSourceImageLimit(
  value: { mode: z.infer<typeof generationModeSchema>; sourceImageUrls?: string[] },
  context: z.RefinementCtx
) {
  const maxImages = value.mode === 'model' ? 6 : 5;
  if ((value.sourceImageUrls?.length ?? 0) > maxImages) {
    context.addIssue({
      code: 'custom',
      path: ['sourceImageUrls'],
      message: `Mode ${value.mode} accepts up to ${maxImages} source images.`
    });
  }
}
