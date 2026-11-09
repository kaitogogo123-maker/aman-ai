import type {
  AspectRatio,
  FontStyle,
  GenerationItem,
  GenerationModel,
  GenerationProvider,
  GenerationTask,
  ImageKind,
  OutputLanguage,
  Resolution,
  TargetPlatform
} from './types';

export type FalQuality = 'standard' | 'premium';

interface FalGenerationInput {
  prompt: string;
  image_urls: string[];
  num_images: number;
  aspect_ratio: AspectRatio;
  resolution: '1K' | '2K' | '4K';
  output_format: 'png';
}

interface FalQueueSubmitOptions {
  input: FalGenerationInput;
}

interface FalQueueSubmitResult {
  request_id: string;
}

interface FalQueueStatusResult {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
}

interface FalQueueResult {
  data?: {
    images?: Array<{ url?: string }>;
  };
}

export interface FalClient {
  submit(modelId: string, options: FalQueueSubmitOptions): Promise<FalQueueSubmitResult>;
  status(
    modelId: string,
    options: { requestId: string; logs?: boolean }
  ): Promise<FalQueueStatusResult>;
  result(modelId: string, options: { requestId: string }): Promise<FalQueueResult>;
}

export interface FalGenerationProviderOptions {
  client: FalClient;
}

type TextDensity = 'full' | 'minimal' | 'silent';

const KIND_TEXT_DENSITY: Record<ImageKind, TextDensity> = {
  selling: 'full',
  closeup: 'minimal',
  scene: 'silent',
  white: 'silent',
  closeup_white: 'silent'
};

const IMAGE_KIND_PROMPTS: Record<ImageKind, string> = {
  selling:
    'main hero shot for an e-commerce listing; single cohesive frame; clean brand-safe typography; do NOT split the image into multi-panel collage; if applicable use a clear headline plus short selling-point copy plus an optional price tag, but adapt the layout to the product category (apparel, beauty, food, 3C, home, etc.) — do not force a rigid template',
  white:
    'pure product packshot on a perfectly clean pure white background; product centered with realistic soft natural shadow; no overlay text, no overlay watermark, no decorative graphics, no display stand or hanger or mannequin; PRESERVE every detail of the original product itself: brand labels, hang tags, embroidery, stitched logos, printed text on fabric, woven tags, buttons, zippers, prints, patterns — anything that is part of the product must remain intact and accurate',
  scene:
    'one cohesive lifestyle scene with the product as the visual focus; realistic environment and natural light; product clearly recognizable with all original details preserved (brand labels, prints, logos that are part of the product); no annotation labels, no panel collage, no callout arrows, no overlay text',
  closeup:
    'one single tightly framed close-up of ONE specific product detail (fabric weave, stitching, hardware, surface texture, or distinctive structure); rich material focus; premium catalog feel; single cohesive frame; do NOT split into multi-panel grid; you MAY add at most 2 short selling-point labels connected to the product with thin minimal leader lines, but do not turn the image into a busy infographic; preserve every original product detail in the close-up area (logo, stitching, embroidery, fabric tag, etc.)',
  closeup_white:
    'one single macro close-up of ONE specific product detail on a perfectly clean pure white background; pure material and texture focus; single cohesive frame; no panel collage; no overlay text, no overlay logos; preserve every original product detail (brand labels, prints, embroidery, stitching, fabric tags that are part of the product)'
};

const KIND_COMPOSITION_HINTS: Record<ImageKind, string> = {
  selling:
    'Use the structured product fields to drive composition: [Product Name] is the natural source of any headline, [Selling Points] is the source of any short bullet copy, and any price hint from the seller input becomes a corner tag. Keep total on-image text minimal and high-contrast. Do not render the bracketed labels themselves on the image.',
  white: '',
  scene:
    'Use [Target Audience] and [Usage Instructions] to inform the realistic scene context (location, atmosphere, who would use it). Render zero on-image text.',
  closeup:
    'Pick ONE single most distinctive detail implied by [Material Description] or [Selling Points] and frame it tightly. If you add any labels, keep them to at most 2 short phrases with thin minimal leader lines and consistent typography. Do not turn the frame into a detail-page infographic.',
  closeup_white: ''
};

export class FalGenerationProvider implements GenerationProvider {
  private readonly client: FalClient;

  constructor(options: FalGenerationProviderOptions) {
    this.client = options.client;
  }

  static modelForQuality(quality: FalQuality): string {
    return quality === 'premium' ? 'fal-ai/nano-banana-pro/edit' : 'fal-ai/nano-banana-2/edit';
  }

  static modelForSelection(model: GenerationModel): string {
    if (model === 'gpt-image-pro') {
      return 'fal-ai/openai/gpt-image-2/edit';
    }
    if (model === 'nano-banana-pro') {
      return 'fal-ai/nano-banana-pro/edit';
    }
    return 'fal-ai/nano-banana-2/edit';
  }

  async startItem({ task, item }: { task: GenerationTask; item: GenerationItem }) {
    const result = await this.client.submit(FalGenerationProvider.modelForSelection(task.settings.model), {
      input: {
        prompt: buildPrompt(task, item),
        image_urls: task.sourceImageUrls?.length ? task.sourceImageUrls : [task.sourceImageUrl],
        num_images: 1,
        aspect_ratio: task.settings.aspectRatio,
        resolution: toFalResolution(task.settings.resolution),
        output_format: 'png'
      }
    });

    return {
      status: 'running' as const,
      requestId: result.request_id
    };
  }

  async syncItem({ task, item }: { task: GenerationTask; item: GenerationItem }) {
    if (!item.providerRequestId) {
      return {
        status: 'failed' as const,
        error: 'Missing fal.ai request ID for this image.'
      };
    }

    const modelId = FalGenerationProvider.modelForSelection(task.settings.model);
    const status = await this.client.status(modelId, {
      requestId: item.providerRequestId,
      logs: false
    });

    if (status.status === 'COMPLETED') {
      const result = await this.client.result(modelId, {
        requestId: item.providerRequestId
      });
      const resultUrl = result.data?.images?.[0]?.url;
      if (!resultUrl) {
        return {
          status: 'failed' as const,
          error: 'fal.ai response did not include an image URL.'
        };
      }

      return {
        status: 'succeeded' as const,
        resultUrl
      };
    }

    if (status.status === 'FAILED') {
      return {
        status: 'failed' as const,
        error: 'fal.ai generation failed.'
      };
    }

    return {
      status: 'running' as const,
      requestId: item.providerRequestId
    };
  }

  async generateItem({ task, item }: { task: GenerationTask; item: GenerationItem }) {
    const started = await this.startItem({ task, item });
    if (started.status !== 'running') {
      throw new Error('fal.ai generation did not return a request ID.');
    }

    const result = await this.client.result(FalGenerationProvider.modelForSelection(task.settings.model), {
      requestId: started.requestId
    });
    const resultUrl = result.data?.images?.[0]?.url;
    if (!resultUrl) {
      throw new Error('fal.ai response did not include an image URL.');
    }

    return { resultUrl };
  }
}

function toFalResolution(resolution: Resolution): '1K' | '2K' | '4K' {
  switch (resolution) {
    case '1k':
      return '1K';
    case '4k':
      return '4K';
    case '2k':
    default:
      return '2K';
  }
}

const MODEL_FLATLAY_PROMPT =
  'apparel flat-lay or on-hanger packshot on a perfectly clean pure white background; NO human model, NO mannequin face, NO body parts visible, NO display rack or stand; show the full garment laid flat or hanging cleanly; realistic soft natural shadow; no overlay text, no overlay watermark, no decorative graphics; PRESERVE every detail of the original garment: brand labels, hang tags, woven tags, embroidery, stitched logos, printed text or graphics, buttons, zippers, fabric texture — anything that is part of the garment must remain intact and accurate';

const ANTI_SPAM_BLOCK =
  'Marketplace compliance: do NOT render any QR codes, barcodes, phone numbers, email addresses, social media handles or URLs, third-party competitor brand logos (logos that are NOT part of the original product itself), marketplace-banned spammy promotional banners (e.g. neon discount stickers, fake "official" badges), or any contact information. CRITICAL: any brand label, logo, hang tag, or printed marking that IS physically part of the original product must be preserved exactly as in the source image.';

interface PlatformRule {
  // When kind === 'selling', force a stricter text density. Other kinds keep their defaults.
  sellingDensityOverride?: TextDensity;
  // When set, selling-kind images are forced onto a strict white background (Amazon/Kaspi rule).
  forceSellingWhite?: boolean;
  // Optional on-image text area cap hint added to non-silent kinds.
  textAreaCap?: '20%' | '30%';
  // Short marketplace-specific note injected into the prompt.
  note?: string;
}

const PLATFORM_RULES: Record<TargetPlatform, PlatformRule> = {
  general: {},
  kaspi: {
    sellingDensityOverride: 'silent',
    forceSellingWhite: true,
    note: 'Target marketplace: Kaspi.kz (Kazakhstan). The main listing image must be a strict pure-white packshot with NO text, NO logo, NO watermark, NO decorative elements. Product must occupy at least 85% of the frame.'
  },
  amazon: {
    sellingDensityOverride: 'silent',
    forceSellingWhite: true,
    note: 'Target marketplace: Amazon. The MAIN listing image must be a strict pure-white (RGB 255,255,255) packshot with NO text, NO logo, NO watermark. Product must occupy at least 85% of the frame.'
  },
  aman: {
    sellingDensityOverride: 'minimal',
    textAreaCap: '30%',
    note: 'Target marketplace: Aman.kz (Kazakhstan). Prefer a clean light or white background; if any on-image text appears, keep it short and brand-safe.'
  },
  tmall: {
    textAreaCap: '20%',
    note: 'Target marketplace: Tmall / Taobao (China). On-image text area must stay under ~20% of the frame; no spammy price tags.'
  },
  jd: {
    textAreaCap: '20%',
    note: 'Target marketplace: JD.com (China). On-image text area must stay under ~20% of the frame.'
  },
  wildberries: {
    note: 'Target marketplace: Wildberries (Russia). Vertical 3:4 framing is preferred. Marketing copy on the main image is allowed in Russian Cyrillic.'
  },
  ozon: {
    note: 'Target marketplace: Ozon (Russia). Vertical 3:4 or square framing. Marketing copy is allowed in Russian Cyrillic.'
  },
  tiktok: {
    textAreaCap: '30%',
    note: 'Target marketplace: TikTok Shop. Square framing. Keep on-image text under ~30% of the frame.'
  },
  shopee: {
    note: 'Target marketplace: Shopee. Square framing. The first hero image should keep a clean light background.'
  }
};

function buildPrompt(task: GenerationTask, item: GenerationItem): string {
  const platform = task.settings.platform ?? 'general';
  const platformRule = PLATFORM_RULES[platform];

  const isModelWhitePackshot = task.settings.mode === 'model' && item.kind === 'white';
  const isSellingForcedWhite = item.kind === 'selling' && platformRule.forceSellingWhite === true;

  let density: TextDensity = KIND_TEXT_DENSITY[item.kind];
  if (item.kind === 'selling' && platformRule.sellingDensityOverride) {
    density = platformRule.sellingDensityOverride;
  }

  let kindPrompt: string;
  if (isModelWhitePackshot) {
    kindPrompt = MODEL_FLATLAY_PROMPT;
  } else if (isSellingForcedWhite) {
    kindPrompt = IMAGE_KIND_PROMPTS.white;
  } else {
    kindPrompt = IMAGE_KIND_PROMPTS[item.kind];
  }

  const compositionHint =
    isSellingForcedWhite ? '' : KIND_COMPOSITION_HINTS[item.kind];

  const modeInstruction =
    isModelWhitePackshot || isSellingForcedWhite
      ? `Create a ${kindPrompt}.`
      : task.settings.mode === 'model'
        ? `Create a fashion model ecommerce image focused on fit, fabric, styling, model pose, and apparel selling points. Image type requirement: ${kindPrompt}.`
        : `Create a ${kindPrompt}.`;

  const productInfoBlock = `Structured product fields (use these to drive composition, do NOT render the bracketed labels literally on the image):\n${task.settings.promptProductInfo ?? task.settings.productInfo}`;

  const textAreaCapBlock =
    platformRule.textAreaCap && density !== 'silent'
      ? `On-image text and graphics must cover no more than ~${platformRule.textAreaCap} of the total frame area.`
      : '';

  return [
    modeInstruction,
    productInfoBlock,
    compositionHint,
    textDensityInstruction(density, task.settings.outputLanguage),
    density === 'silent' ? '' : fontStyleInstruction(task.settings.fontStyle),
    textAreaCapBlock,
    platformRule.note ?? '',
    ANTI_SPAM_BLOCK,
    'Keep the original product identity 100% accurate: preserve every brand label, logo, hang tag, embroidery, stitched detail, printed text, fabric tag, button, zipper, and visible feature that is part of the original product. Do not invent or remove product features. Single cohesive frame; do not split into a multi-panel collage unless explicitly required above.'
  ].filter(Boolean).join('\n\n');
}

function textDensityInstruction(density: TextDensity, language: OutputLanguage): string {
  switch (density) {
    case 'full':
      return languageInstruction(language);
    case 'minimal':
      return `If you add any on-image text, use natural ${languageDisplayName(language)} marketplace wording. Limit to at most 2 short selling-point labels, each ≤ 8 characters, with thin minimal leader lines and consistent typography. Do NOT fill the frame with text.`;
    case 'silent':
    default:
      return 'Do NOT render any text, captions, marketing copy, prices, labels, callout dots, leader lines, logos, badges, or watermarks anywhere in the frame. Deliver a clean image with the product only.';
  }
}

function languageDisplayName(language: OutputLanguage): string {
  switch (language) {
    case 'ru':
      return 'Russian (Cyrillic)';
    case 'kk':
      return 'Kazakh (Cyrillic)';
    case 'en':
      return 'English';
    case 'zh':
      return 'Simplified Chinese';
  }
}

function languageInstruction(language: OutputLanguage): string {
  const instructions: Record<OutputLanguage, string> = {
    ru: 'All visible text on the generated image must be natural Russian marketplace copy written in Cyrillic.',
    kk: 'All visible text on the generated image must be natural Kazakh marketplace copy written in Kazakh Cyrillic.',
    en: 'All visible text on the generated image must be natural English marketplace copy.',
    zh: 'All visible text on the generated image must be natural Chinese marketplace copy, using Simplified Chinese.'
  };

  return instructions[language];
}

function fontStyleInstruction(style: FontStyle): string {
  const instructions: Record<FontStyle, string> = {
    auto: 'Let the model choose a clean, legible ecommerce type style.',
    geometric_sans: 'Use a modern geometric sans-serif type style with clean shapes and balanced spacing.',
    bold_sans: 'Use a bold sans-serif headline style with strong hierarchy and high readability.',
    elegant_serif: 'Use an elegant serif type style with refined, premium editorial character.'
  };

  return instructions[style];
}
