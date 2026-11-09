import { z } from 'zod';
import type { AnalyzeProductInput, ProductAnalysis, ProductAnalyzer } from './types';

type Fetcher = typeof fetch;
const ANALYSIS_REQUEST_TIMEOUT_MS = 300_000;
const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;

const productAnalysisSchema = z.object({
  productName: z.string().default(''),
  targetAudience: z.string().default(''),
  sellingPoints: z.string().default(''),
  materialDescription: z.string().default(''),
  usageInstructions: z.string().default(''),
  category: z.string().default('')
});

export interface QwenVisualAnalyzerOptions {
  apiKey: string;
  endpoint: string;
  textModel: string;
  visionModel: string;
  fetcher?: Fetcher;
}

export class QwenVisualAnalyzer implements ProductAnalyzer {
  readonly textModel: string;
  readonly visionModel: string;

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetcher: Fetcher;

  constructor(options: QwenVisualAnalyzerOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint.replace(/\/$/, '');
    this.textModel = options.textModel;
    this.visionModel = options.visionModel;
    this.fetcher = options.fetcher ?? fetch;
  }

  async analyze(input: AnalyzeProductInput): Promise<ProductAnalysis> {
    const sourceImages = sourceImagesForAnalysis(input);
    const hasImages = sourceImages.length > 0;
    const completeLocalAnalysis = buildCompleteStructuredLocalAnalysis(input);
    if (completeLocalAnalysis && !hasImages) {
      return completeLocalAnalysis;
    }

    const model = sourceImages.length > 0 ? this.visionModel : this.textModel;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_REQUEST_TIMEOUT_MS);
    try {
      const promptSourceImages = hasImages
        ? await prepareSourceImagesForPrompt(sourceImages, this.fetcher, controller.signal)
        : [];
      const requestBody = JSON.stringify({
        model,
        temperature: 0.2,
        enable_thinking: false,
        ...(hasImages ? { vl_high_resolution_images: true } : {}),
        response_format: {
          type: 'json_object'
        },
        messages: [
          {
            role: 'system',
            content: buildSystemText(input)
          },
          {
            role: 'user',
            content: [
              ...promptSourceImages.map((url) => ({
                type: 'image_url',
                image_url: { url }
              })),
              {
                type: 'text',
                text: buildUserText(input, sourceImages.length > 0)
              }
            ]
          }
        ]
      });

      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await this.fetcher(`${this.endpoint}/chat/completions`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: requestBody
          });

          if (!response.ok) {
            throw await buildRequestError(response, model);
          }

          const data = (await parseResponseJson(response)) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = data.choices?.[0]?.message?.content;

          if (!content) {
            throw new Error('Qwen visual analysis response did not include message content.');
          }

          const parsed = productAnalysisSchema.safeParse(parseAnalysisContent(content, input.productInfoRaw, !hasImages));
          if (!parsed.success) {
            throw new Error('Qwen visual analysis response did not include valid analysis JSON.');
          }

          return ensureUsableAnalysis(parsed.data, input, hasImages);
        } catch (caughtError) {
          lastError = caughtError;
          if (attempt > 0 || !shouldRetryAnalysisError(caughtError)) {
            throw caughtError;
          }
        }
      }

      throw lastError;
    } catch (error) {
      const fallback = buildLocalTextAnalysis(input.productInfoRaw, analysisMode(input), input.locale);
      if (fallback && !hasImages) {
        console.warn('Product analysis provider failed; using local text fallback', {
          model,
          hasImage: hasImages,
          rawLength: input.productInfoRaw.length,
          error: error instanceof Error ? error.message : String(error)
        });
        return fallback;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function buildSystemText(input: AnalyzeProductInput) {
  const fields = 'productName, targetAudience, sellingPoints, materialDescription, usageInstructions, category';
  const outputLanguage = describeAnalysisLanguage(detectAnalysisLanguage(input.productInfoRaw, input.locale));
  const shared = [
    `Return strict JSON with fields: ${fields}.`,
    `Return field values in ${outputLanguage}, the same language as the seller text. If the seller text is empty, use the UI locale language.`,
    'If an image is provided, inspect visible product details directly: object type, shape, color, material cues, text/labels, style, usage context, and category.',
    'If the seller text is short, infer missing commercial details from the image instead of repeating the short text.',
    'Do not merely paraphrase the seller text when the image contains useful visual information.',
    'At least three non-empty fields must mention visible image evidence such as color, shape, silhouette, label text, packaging, material texture, component layout, or styling details.',
    'Output must be commercially useful for ecommerce image generation: specific, concrete, visual, and ready for the seller to edit.',
    'Avoid generic filler such as "highlight core benefits", "add material details", or "suitable for marketplace images" unless the same sentence also contains concrete product details from the image.',
    'Every non-empty field except category must include at least one concrete product-specific detail from the seller text or the image.',
    'If the seller text says only a broad product word, identify the exact visible product type and visible details from the image instead of repeating that word.',
    'Do not invent exact measurements, certifications, or unsupported facts.'
  ].join(' ');

  if (analysisMode(input) === 'model') {
    return [
      'You are analyzing inputs for a fashion model image generator.',
      shared,
      'Use the JSON keys as sections for an apparel brief.',
      'When an apparel image is provided, describe visible garment category, silhouette, color/wash, texture, pockets, buttons, stitching, hardware, collar/waist/hem design, model assumptions, and styling scenes.',
      'productName should contain the base profile: product name, apparel style/category, silhouette, visible color, and model/sales-region assumptions when provided or visible.',
      'targetAudience should contain construction and craft details: fabric, wash, cut, pockets, buttons, stitching, hardware, and texture.',
      'sellingPoints should contain functionality and wearing experience: comfort, movement, durability, warmth/breathability, care, and seasonal fit.',
      'materialDescription should contain styling plans and suitable scenarios: outfit ideas, occasions, style positioning, and matching suggestions.',
      'usageInstructions should contain core marketing selling points written as concise ecommerce copy.',
      'category should contain the apparel category path when inferable.',
      'Do not use framework labels as field values; never return values like 工艺细节, 功能性, 穿搭方案, 核心营销卖点, or 服装类目 by themselves.'
    ].join(' ');
  }

  return [
    shared,
    'When a product image is provided, describe visible color, shape, finish, packaging, labels, component layout, product surface, and practical use scenes.',
    'For product images, productName must be the actual product name.',
    'targetAudience must describe likely buyers and usage contexts.',
    'sellingPoints must include concrete benefits visible in the image or provided in seller text.',
    'materialDescription must describe visible or provided materials, texture, finish, packaging, and construction.',
    'usageInstructions must describe practical use, setup, care, or ecommerce display scenarios.',
    'category must include a reasonable ecommerce category when inferable.'
  ].join(' ');
}

function buildUserText(input: AnalyzeProductInput, hasImages: boolean) {
  return [
    ...(hasImages
      ? [
          'Only analyze the primary product image.',
          'Do not infer product facts from reference images; they are reserved for generation, not product analysis.'
        ]
      : ['No product image was provided. Analyze only the seller text.']),
    ...(analysisMode(input) === 'model'
      ? [
          'Mode: fashion model image.',
          'Analyze according to this framework: 基础档案、工艺细节、功能性、穿搭方案、核心营销卖点.',
          'Include clothing style/category, fabric, model or sales region, product benefits, and styling/use scenes when available.'
        ]
      : ['Mode: product image. Analyze product name, target audience, selling points, material, usage, and category.']),
    `User raw product info:\n${input.productInfoRaw}`,
    `UI locale: ${input.locale}`,
    `Seller text language: ${describeAnalysisLanguage(detectAnalysisLanguage(input.productInfoRaw, input.locale))}`
  ].join('\n\n');
}

async function buildRequestError(response: Response, model: string) {
  const bodyText = await response.text();
  const providerCode = readProviderErrorCode(bodyText);

  if (response.status === 403 && providerCode === 'Model.AccessDenied') {
    return new Error(
      `Alibaba Cloud Model Studio has not enabled access to ${model}. Enable this Qwen-VL model or configure ALI_DASHSCOPE_ANALYSIS_VISION_MODEL to a model your key can access.`
    );
  }

  return new Error(`Qwen product analysis request failed with ${response.status}: ${bodyText}`);
}

function readProviderErrorCode(bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { code?: unknown } };
    return typeof parsed.error?.code === 'string' ? parsed.error.code : undefined;
  } catch {
    return undefined;
  }
}

function sourceImagesForAnalysis(input: AnalyzeProductInput) {
  if (input.sourceImageUrls?.length) {
    return input.sourceImageUrls.slice(0, 1);
  }

  return input.sourceImageUrl ? [input.sourceImageUrl] : [];
}

async function prepareSourceImagesForPrompt(urls: string[], fetcher: Fetcher, signal: AbortSignal) {
  const prepared: string[] = [];

  for (const url of urls) {
    prepared.push(await inlineCloudflareR2ImageIfNeeded(url, fetcher, signal));
  }

  return prepared;
}

async function inlineCloudflareR2ImageIfNeeded(url: string, fetcher: Fetcher, signal: AbortSignal) {
  if (url.startsWith('data:') || !shouldInlineImageUrl(url)) {
    return url;
  }

  let response: Response;
  try {
    response = await fetcher(url, { signal });
  } catch (fetchError) {
    console.error('R2 image fetch threw', {
      url: redactPresignedUrl(url),
      error: fetchError instanceof Error ? fetchError.message : String(fetchError)
    });
    throw new Error('Could not read uploaded product image for AI analysis.');
  }

  if (!response.ok) {
    const bodyPreview = await response
      .clone()
      .text()
      .then((text) => text.slice(0, 200))
      .catch(() => '');
    console.error('R2 image fetch failed', {
      url: redactPresignedUrl(url),
      status: response.status,
      statusText: response.statusText,
      bodyPreview
    });
    throw new Error('Could not read uploaded product image for AI analysis.');
  }

  const mimeType = resolveImageMimeType(response.headers.get('Content-Type'), url);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_INLINE_IMAGE_BYTES) {
    throw new Error('Uploaded product image is too large for AI analysis.');
  }

  return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
}

function shouldInlineImageUrl(urlText: string) {
  try {
    const { hostname } = new URL(urlText);
    // Public R2.dev URLs are permanent + globally fetchable by Qwen directly.
    // Skip Worker-side inline (避免 8MB 限制 + base64 体积膨胀).
    if (hostname.endsWith('.r2.dev')) {
      return false;
    }
    // S3-compatible presigned URLs: still inline because Qwen 跨境 fetch presigned 不稳.
    return (
      hostname === 'r2.cloudflarestorage.com' ||
      hostname.endsWith('.r2.cloudflarestorage.com')
    );
  } catch {
    return false;
  }
}

function resolveImageMimeType(contentType: string | null, urlText: string) {
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase();
  if (normalized && ['image/jpeg', 'image/png', 'image/webp'].includes(normalized)) {
    return normalized;
  }

  const pathname = safeUrlPathname(urlText).toLowerCase();
  if (pathname.endsWith('.png')) {
    return 'image/png';
  }
  if (pathname.endsWith('.webp')) {
    return 'image/webp';
  }
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  throw new Error('Uploaded product image format is not supported for AI analysis.');
}

function safeUrlPathname(urlText: string) {
  try {
    return new URL(urlText).pathname;
  } catch {
    return '';
  }
}

function redactPresignedUrl(urlText: string) {
  try {
    const parsed = new URL(urlText);
    return `${parsed.origin}${parsed.pathname}?X-Amz-Date=${parsed.searchParams.get('X-Amz-Date') ?? ''}&X-Amz-Expires=${parsed.searchParams.get('X-Amz-Expires') ?? ''}`;
  } catch {
    return urlText.slice(0, 120);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function analysisMode(input: AnalyzeProductInput) {
  return input.mode ?? 'product';
}

function shouldRetryAnalysisError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /response did not include message content|response did not include valid analysis json/i.test(message);
}

function parseAnalysisContent(content: string, productInfoRaw: string, allowTextFallback: boolean): unknown {
  const normalized = extractJsonObjectText(content);
  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'analysis' in parsed &&
      (parsed as { analysis?: unknown }).analysis &&
      typeof (parsed as { analysis?: unknown }).analysis === 'object'
    ) {
      return (parsed as { analysis: unknown }).analysis;
    }
    return parsed;
  } catch {
    if (!allowTextFallback) {
      throw new Error('Qwen visual analysis response did not include valid analysis JSON.');
    }

    const fallbackName = productInfoRaw.trim();
    if (fallbackName) {
      return {
        productName: fallbackName,
        targetAudience: '',
        sellingPoints: '',
        materialDescription: '',
        usageInstructions: '',
        category: ''
      };
    }
    throw new Error('Qwen visual analysis response did not include valid analysis JSON.');
  }
}

function ensureUsableAnalysis(analysis: ProductAnalysis, input: AnalyzeProductInput, hasImages: boolean): ProductAnalysis {
  const mode = analysisMode(input);
  const cleaned = removeFrameworkPlaceholders(analysis);
  if (hasImages && !hasUsefulVisualAnalysis(cleaned)) {
    throw new Error('Image analysis did not include enough visual product details.');
  }
  if (hasImages) {
    return cleaned;
  }

  const completionSeed = cleaned.productName || input.productInfoRaw;
  const local = buildLocalTextAnalysis(completionSeed, mode, input.locale) ?? buildLocalTextAnalysis(input.productInfoRaw, mode, input.locale);
  if (!local) {
    return cleaned;
  }

  return {
    productName: cleaned.productName.trim() || local.productName,
    targetAudience: cleaned.targetAudience.trim() || local.targetAudience,
    sellingPoints: cleaned.sellingPoints.trim() || local.sellingPoints,
    materialDescription: cleaned.materialDescription.trim() || local.materialDescription,
    usageInstructions: cleaned.usageInstructions.trim() || local.usageInstructions,
    category: cleaned.category.trim() || local.category
  };
}

function buildCompleteStructuredLocalAnalysis(input: AnalyzeProductInput): ProductAnalysis | null {
  const raw = input.productInfoRaw.trim();
  if (!raw) {
    return null;
  }

  const fields = extractBracketedFields(raw);
  if (!Object.values(fields).some((value) => value.trim().length > 0)) {
    return null;
  }

  return isStructuredAnalysisComplete(fields)
    ? ensureLocalCompleteness(fields, raw, analysisMode(input), input.locale)
    : null;
}

function buildLocalTextAnalysis(
  productInfoRaw: string,
  mode: AnalyzeProductInput['mode'] = 'product',
  locale: AnalyzeProductInput['locale'] = 'zh'
): ProductAnalysis | null {
  const raw = productInfoRaw.trim();
  if (!raw) {
    return null;
  }

  const fields = extractBracketedFields(raw);
  if (Object.values(fields).some(Boolean)) {
    const analysis = {
      productName: fields.productName,
      targetAudience: fields.targetAudience,
      sellingPoints: fields.sellingPoints,
      materialDescription: fields.materialDescription,
      usageInstructions: fields.usageInstructions,
      category: fields.category
    };
    return ensureLocalCompleteness(analysis, raw, mode, locale);
  }

  const compact = raw.replace(/\s+/g, ' ');
  const firstSentence = compact.match(/^(.+?[.!?。！？])(?:\s+|$)/)?.[1] ?? compact;
  const remaining = compact.slice(firstSentence.length).trim();
  const withoutPunctuation = firstSentence.replace(/[.!?。！？]+$/, '').trim();
  const forMatch = withoutPunctuation.match(/^(.+?)\s+for\s+(.+)$/i);

  if (forMatch?.[1]) {
    return ensureLocalCompleteness(
      {
        productName: forMatch[1].trim(),
        targetAudience: forMatch[2]?.trim() ?? '',
        sellingPoints: remaining || '',
        materialDescription: '',
        usageInstructions: '',
        category: ''
      },
      raw,
      mode,
      locale
    );
  }

  return ensureLocalCompleteness(
    {
      productName: withoutPunctuation || compact,
      targetAudience: '',
      sellingPoints: remaining || '',
      materialDescription: '',
      usageInstructions: '',
      category: ''
    },
    raw,
    mode,
    locale
  );
}

function ensureLocalCompleteness(
  analysis: ProductAnalysis,
  raw: string,
  mode: AnalyzeProductInput['mode'],
  locale: AnalyzeProductInput['locale']
): ProductAnalysis {
  const subject = analysis.productName || raw;
  const language = detectAnalysisLanguage(raw, locale);
  if (mode === 'model') {
    return completeModelAnalysis(analysis, subject, language);
  }

  return completeProductAnalysis(analysis, subject, language);
}

function completeProductAnalysis(analysis: ProductAnalysis, subject: string, language: AnalysisLanguage): ProductAnalysis {
  if (language === 'en') {
    return {
      productName: subject,
      targetAudience: analysis.targetAudience || `Suitable for customers who care about ${subject} quality, daily use, or gifting.`,
      sellingPoints: analysis.sellingPoints || `${subject} can highlight core benefits, user experience, appearance, texture, and practical scenarios.`,
      materialDescription: analysis.materialDescription || `Add the material, finish, packaging, construction, and tactile details of ${subject} to make generation more stable.`,
      usageInstructions: analysis.usageInstructions || 'Suitable for marketplace hero images, selling-point visuals, lifestyle scenes, and detail displays.',
      category: analysis.category || ''
    };
  }

  if (language === 'ru') {
    return {
      productName: subject,
      targetAudience: analysis.targetAudience || `Подходит покупателям, которым важны качество, ежедневное использование или подарок: ${subject}.`,
      sellingPoints: analysis.sellingPoints || `${subject}: можно раскрыть ключевые преимущества, опыт использования, внешний вид и сценарии применения.`,
      materialDescription: analysis.materialDescription || `Добавьте материалы, отделку, упаковку, конструкцию и тактильные детали ${subject}, чтобы генерация была стабильнее.`,
      usageInstructions: analysis.usageInstructions || 'Подходит для главных фото маркетплейса, продающих визуалов, сцен использования и детальных кадров.',
      category: analysis.category || ''
    };
  }

  if (language === 'kk') {
    return {
      productName: subject,
      targetAudience: analysis.targetAudience || `${subject} сапасына, күнделікті қолдануға немесе сыйлыққа мән беретін сатып алушыларға лайық.`,
      sellingPoints: analysis.sellingPoints || `${subject} үшін негізгі артықшылықтарды, қолдану әсерін, сыртқы көрінісін және қолдану сценарийін көрсетуге болады.`,
      materialDescription: analysis.materialDescription || `${subject} материалы, өңдеуі, қаптамасы, құрылымы және сезілетін детальдары туралы ақпарат қоссаңыз, генерация тұрақтырақ болады.`,
      usageInstructions: analysis.usageInstructions || 'Маркетплейс басты суреті, сату артықшылығы, қолдану сахнасы және детальды кадрлар үшін қолайлы.',
      category: analysis.category || ''
    };
  }

  return {
    productName: subject,
    targetAudience: analysis.targetAudience || `适合关注 ${subject} 品质、日常使用或礼赠需求的用户。`,
    sellingPoints: analysis.sellingPoints || `${subject} 可突出核心功能、使用体验、外观质感和适用场景。`,
    materialDescription: analysis.materialDescription || `可补充 ${subject} 的材质、工艺、包装或触感细节，让生成图更稳定。`,
    usageInstructions: analysis.usageInstructions || `适合电商主图、卖点图、场景图和细节展示图。`,
    category: analysis.category || ''
  };
}

function completeModelAnalysis(analysis: ProductAnalysis, subject: string, language: AnalysisLanguage): ProductAnalysis {
  if (language === 'en') {
    return {
      productName: subject,
      targetAudience: analysis.targetAudience || `Describe the fabric, wash, cut, structure, hardware, seams, and visible construction details of ${subject}.`,
      sellingPoints: analysis.sellingPoints || `Summarize comfort, movement, durability, seasonal fit, and practical wearing benefits for ${subject}.`,
      materialDescription: analysis.materialDescription || `Add outfit ideas, use scenes, sales region, and styling direction for ${subject}.`,
      usageInstructions: analysis.usageInstructions || `Write concise ecommerce marketing points for ${subject}, focused on body proportion, texture, style, and use cases.`,
      category: analysis.category || ''
    };
  }

  if (language === 'ru') {
    return {
      productName: subject,
      targetAudience: analysis.targetAudience || `Опишите ткань, стирку, крой, конструкцию, фурнитуру, швы и видимые детали ${subject}.`,
      sellingPoints: analysis.sellingPoints || `Соберите функциональные преимущества ${subject}: комфорт, свобода движения, износостойкость, сезонность и практичность.`,
      materialDescription: analysis.materialDescription || `Добавьте идеи стилизации, сценарии носки, регион продаж и модное направление для ${subject}.`,
      usageInstructions: analysis.usageInstructions || `Подготовьте краткие маркетинговые тезисы для ${subject}: пропорции, фактура, стиль и сценарии использования.`,
      category: analysis.category || ''
    };
  }

  if (language === 'kk') {
    return {
      productName: subject,
      targetAudience: analysis.targetAudience || `${subject} матасын, жуу өңдеуін, пішімін, құрылымын, фурнитурасын, тігісін және көрінетін бөлшектерін сипаттаңыз.`,
      sellingPoints: analysis.sellingPoints || `${subject} бойынша жайлылық, қозғалыс еркіндігі, төзімділік, маусымдық сәйкестік және практикалық артықшылықтарды жинақтаңыз.`,
      materialDescription: analysis.materialDescription || `${subject} үшін образ идеяларын, кию сценарийін, сату өңірін және стиль бағытын қосыңыз.`,
      usageInstructions: analysis.usageInstructions || `${subject} үшін пропорция, фактура, стиль және қолдану сценарийіне бағытталған қысқа маркетингтік тезистер жазыңыз.`,
      category: analysis.category || ''
    };
  }

  return {
    productName: subject,
    targetAudience: analysis.targetAudience || `${subject} 的面料、洗水、版型结构、五金、走线和可见工艺细节。`,
    sellingPoints: analysis.sellingPoints || `围绕 ${subject} 的舒适度、活动自由度、耐用性、季节适配和穿着体验整理功能卖点。`,
    materialDescription: analysis.materialDescription || `${subject} 的穿搭方案、使用场景、销售地区和风格定位。`,
    usageInstructions: analysis.usageInstructions || `围绕 ${subject} 的身材比例、质感、风格和使用场景提炼电商营销卖点。`,
    category: analysis.category || ''
  };
}

function extractBracketedFields(raw: string): ProductAnalysis {
  const fields: ProductAnalysis = {
    productName: '',
    targetAudience: '',
    sellingPoints: '',
    materialDescription: '',
    usageInstructions: '',
    category: ''
  };
  const aliases: Array<[keyof ProductAnalysis, string[]]> = [
    ['productName', ['产品名称', '商品名称', 'Product name', '基础档案', '款式品类', 'Style category']],
    ['targetAudience', ['目标受众', 'Target audience', '工艺细节', '面料', 'Fabric', '模特/销售地区', 'Model / sales region']],
    ['sellingPoints', ['卖点描述', '商品卖点', '核心卖点', '核心营销卖点提炼', '功能性', 'Selling points']],
    ['materialDescription', ['材质描述', '材料描述', 'Material description', '服装基础档案', '穿搭方案']],
    ['usageInstructions', ['使用方式', '使用方法', '使用场景', '场景适配与穿搭方案', '核心营销卖点', 'Usage instructions']],
    ['category', ['产品类目', '商品类目', '服装类目', 'Product category']]
  ];
  const labelToField = new Map<string, keyof ProductAnalysis>();
  for (const [field, names] of aliases) {
    for (const name of names) {
      labelToField.set(name.toLowerCase(), field);
    }
  }
  const allLabels = Array.from(labelToField.keys()).sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  const matches = Array.from(raw.matchAll(new RegExp(`(?:\\[(${allLabels})\\]|(${allLabels}))\\s*[：:]`, 'giu')));

  if (matches.length > 0) {
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const label = (match[1] ?? match[2] ?? '').toLowerCase();
      const field = labelToField.get(label);
      if (!field || fields[field]) {
        continue;
      }

      const valueStart = (match.index ?? 0) + match[0].length;
      const valueEnd = matches[index + 1]?.index ?? raw.length;
      fields[field] = raw.slice(valueStart, valueEnd).trim();
    }

    return fields;
  }

  for (const [field, names] of aliases) {
    for (const name of names) {
      const match = raw.match(new RegExp(`(?:\\[${escapeRegExp(name)}\\]|${escapeRegExp(name)})\\s*[：:]\\s*([^\\n]+)`, 'i'));
      if (match?.[1]) {
        fields[field] = match[1].trim();
        break;
      }
    }
  }

  return fields;
}

type AnalysisLanguage = 'zh' | 'en' | 'ru' | 'kk';

function detectAnalysisLanguage(raw: string, locale: AnalyzeProductInput['locale']): AnalysisLanguage {
  if (/[\u4e00-\u9fff]/.test(raw)) {
    return 'zh';
  }

  if (/[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/.test(raw)) {
    return 'kk';
  }

  if (/[А-Яа-яЁё]/.test(raw)) {
    return 'ru';
  }

  return raw.trim() ? 'en' : locale;
}

function describeAnalysisLanguage(language: AnalysisLanguage) {
  switch (language) {
    case 'zh':
      return 'Chinese';
    case 'ru':
      return 'Russian';
    case 'kk':
      return 'Kazakh';
    case 'en':
    default:
      return 'English';
  }
}

function isStructuredAnalysisComplete(analysis: ProductAnalysis) {
  return [
    analysis.productName,
    analysis.targetAudience,
    analysis.sellingPoints,
    analysis.materialDescription,
    analysis.usageInstructions
  ].every((value) => value.trim().length > 0);
}

function removeFrameworkPlaceholders(analysis: ProductAnalysis): ProductAnalysis {
  return {
    productName: cleanFrameworkPlaceholder(analysis.productName),
    targetAudience: cleanFrameworkPlaceholder(analysis.targetAudience),
    sellingPoints: cleanFrameworkPlaceholder(analysis.sellingPoints),
    materialDescription: cleanFrameworkPlaceholder(analysis.materialDescription),
    usageInstructions: cleanFrameworkPlaceholder(analysis.usageInstructions),
    category: cleanFrameworkPlaceholder(analysis.category)
  };
}

function cleanFrameworkPlaceholder(value: string) {
  const normalized = value.trim();
  return isFrameworkPlaceholder(normalized) ? '' : normalized;
}

function isFrameworkPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();
  return [
    '基础档案',
    '工艺细节',
    '功能性',
    '穿搭方案',
    '核心营销卖点',
    '服装类目',
    'base profile',
    'construction details',
    'functionality',
    'styling plan',
    'core marketing points',
    'apparel category'
  ].includes(normalized);
}

function hasUsefulVisualAnalysis(analysis: ProductAnalysis) {
  const detailCount = [
    analysis.targetAudience,
    analysis.sellingPoints,
    analysis.materialDescription,
    analysis.usageInstructions,
    analysis.category
  ].filter((value) => value.trim().length >= 8 && !isFrameworkPlaceholder(value) && !isGenericAnalysisDetail(value)).length;

  return detailCount >= 2;
}

function isGenericAnalysisDetail(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ');
  return [
    '适合关注',
    '品质、日常使用或礼赠需求',
    '可突出核心功能',
    '使用体验、外观质感和适用场景',
    '可补充',
    '让生成图更稳定',
    '适合电商主图',
    '卖点图、场景图和细节展示图',
    'suitable for customers who care about',
    'can highlight core benefits',
    'add the material',
    'to make generation more stable',
    'suitable for marketplace hero images',
    'подходит покупателям',
    'можно раскрыть ключевые преимущества',
    'добавьте материалы',
    'чтобы генерация была стабильнее',
    'маркетплейс басты суреті',
    'негізгі артықшылықтарды',
    'генерация тұрақтырақ'
  ].some((phrase) => normalized.includes(phrase));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractJsonObjectText(content: string) {
  const fencedJson = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }

  return content.trim();
}

async function parseResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Qwen visual analysis response did not include valid analysis JSON.');
  }
}
