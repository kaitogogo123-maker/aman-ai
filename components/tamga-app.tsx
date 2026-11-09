'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ImageLightbox, type LightboxItem } from '@/components/image-lightbox';
import { CreateGate } from '@/components/create-gate';
import { showToast } from '@/components/toast';
import { formatProductAnalysisForTextarea } from '@/lib/core/analysis/format-product-info';
import type { ProductAnalysis } from '@/lib/core/analysis/types';
import type {
  AspectRatio,
  FontStyle,
  GenerationMode,
  GenerationModel,
  ImageKind,
  OutputLanguage,
  Resolution,
  TargetPlatform
} from '@/lib/core/generation/types';
import {
  nextPrimaryImageIdAfterRemoval,
  orderedSourceImages,
  sourceImagesSignature,
  type LocalSourceImage
} from '@/lib/core/images/source-images';
import {
  composeProductInfoWithQuickChips,
  createTamgaModeDrafts,
  EMPTY_ANALYSIS,
  updateTamgaModeDraft,
  type QuickChipGroupKey,
  type TamgaModeDraft
} from '@/lib/core/ui/tamga-mode-drafts';
import { PLATFORM_PRESETS } from '@/lib/core/ui/platform-presets';
import { priceForCount } from '@/lib/core/pricing';
import { MAX_PER_BATCH, MAX_PER_TYPE } from '@/lib/core/generation/settings';
import {
  fontStyleLabel,
  getMessages,
  imageKindLabel,
  outputLanguageLabel,
  platformLabel,
  PLATFORM_LOCAL_ORDER,
  resolveLocale,
  SUPPORTED_LOCALES,
  type TargetPlatformCode
} from '@/lib/i18n';

const RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '2:3', '3:2', '9:16', '16:9', '4:5', '5:4', '21:9', '9:21'];
const PRIMARY_RATIOS: AspectRatio[] = ['1:1', '3:4', '4:3', '9:16', '16:9'];
const LANGUAGES: OutputLanguage[] = [...SUPPORTED_LOCALES];
const FONT_STYLES: FontStyle[] = ['auto', 'geometric_sans', 'bold_sans', 'elegant_serif'];
const FONT_STYLE_LOCALES: ReadonlyArray<'zh' | 'en'> = ['zh', 'en'];
const RESOLUTIONS: Resolution[] = ['2k'];


const ALL_PLATFORMS: TargetPlatform[] = [
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
];

const HIDDEN_PLATFORMS_BY_LOCALE: Record<string, TargetPlatform[]> = {
  ru: ['tmall', 'jd'],
  kk: ['tmall', 'jd']
};

const DEFAULT_PLATFORM_BY_LOCALE: Record<string, TargetPlatform> = {
  kk: 'general',
  ru: 'general',
  zh: 'tmall',
  en: 'amazon'
};

const SIMPLIFIED_RATIOS: AspectRatio[] = ['1:1', '3:4', '9:16'];
const DEFAULT_PREVIEW_URL = '/mock-results/source-product.svg';
// 余额不足跳支付前,把本次待生成请求存这里;付款回跳结算入账后自动续生成。
const PENDING_GENERATION_KEY = 'aman_pending_generation';
const PRODUCT_MAX_SOURCE_IMAGES = 5;
const MODEL_MAX_SOURCE_IMAGES = 6;

export function TamgaApp({ locale, initialMode = 'product' }: { locale: string; initialMode?: GenerationMode }) {
  const router = useRouter();
  const fileInputId = useId();
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const [mode, setMode] = useState<GenerationMode>(initialMode);
  const [modeDrafts, setModeDrafts] = useState<Record<GenerationMode, TamgaModeDraft>>(() => createTamgaModeDrafts());
  const [model, setModel] = useState<GenerationModel>('nano-banana-2');
  // Aman AI 设计稿无版本选择器，UI 隐藏但保留 model 逻辑（默认 nano-banana-2）
  const SHOW_MODEL_PICKER = false;
  const [resolution, setResolution] = useState<Resolution>('2k');
  const isSimplifiedLocale = currentLocale === 'ru' || currentLocale === 'kk';
  const initialPlatform: TargetPlatform = DEFAULT_PLATFORM_BY_LOCALE[currentLocale] ?? 'general';
  const initialPreset = PLATFORM_PRESETS[initialPlatform];
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialPreset.ratio);
  const [outputLanguages, setOutputLanguages] = useState<OutputLanguage[]>(() => [...initialPreset.languages]);
  const [platform, setPlatform] = useState<TargetPlatform>(initialPlatform);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [fontStyle, setFontStyle] = useState<FontStyle>('auto');
  const showFontStylePicker = (FONT_STYLE_LOCALES as ReadonlyArray<string>).includes(currentLocale);
  const [showAllRatios, setShowAllRatios] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightUpload, setHighlightUpload] = useState(false);
  const uploadFieldRef = useRef<HTMLDivElement | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const activeDraft = modeDrafts[mode];
  const {
    productInfo,
    counts,
    hasManualCountEdits,
    sourceImages,
    primaryImageId,
    analysis,
    analysisSourceKey,
    analysisError,
    selectedQuickChips
  } = activeDraft;

  function updateActiveDraft(patch: Partial<TamgaModeDraft> | ((draft: TamgaModeDraft) => Partial<TamgaModeDraft>)) {
    setModeDrafts((current) => updateTamgaModeDraft(current, mode, patch));
  }

  function setProductInfo(next: string | ((current: string) => string)) {
    updateActiveDraft((draft) => ({
      productInfo: typeof next === 'function' ? next(draft.productInfo) : next
    }));
  }

  function setCounts(next: Record<ImageKind, number> | ((current: Record<ImageKind, number>) => Record<ImageKind, number>)) {
    updateActiveDraft((draft) => ({
      counts: typeof next === 'function' ? next(draft.counts) : next
    }));
  }

  function setSourceImages(next: LocalSourceImage[] | ((current: LocalSourceImage[]) => LocalSourceImage[])) {
    updateActiveDraft((draft) => ({
      sourceImages: typeof next === 'function' ? next(draft.sourceImages) : next
    }));
  }

  function setPrimaryImageId(next: string | null | ((current: string | null) => string | null)) {
    updateActiveDraft((draft) => ({
      primaryImageId: typeof next === 'function' ? next(draft.primaryImageId) : next
    }));
  }

  function setAnalysis(next: ProductAnalysis) {
    updateActiveDraft({ analysis: next });
  }

  function setAnalysisSourceKey(next: string | null) {
    updateActiveDraft({ analysisSourceKey: next });
  }

  function setAnalysisError(next: string | null) {
    updateActiveDraft({ analysisError: next });
  }

  const totalImages = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts]
  );
  const hasTextKinds = counts.selling > 0 || counts.closeup > 0;
  // 实际会发起的生成请求数:带文字图按选中的输出语言各生成一套(每套独立扣费),否则 1 套
  const requestCount = hasTextKinds ? Math.max(outputLanguages.length, 1) : 1;
  // 生图消耗的额度张数(带文字图按输出语言各生成一套,每套独立扣额度)
  const billedImages = totalImages * requestCount;
  const hasAnalysis = useMemo(
    () => Object.values(analysis).some((value) => value.trim().length > 0),
    [analysis]
  );
  const currentAnalysisSourceKey = useMemo(
    () => buildAnalysisSourceKey({
      productInfo,
      sourceImages,
      primaryImageId
    }),
    [productInfo, sourceImages, primaryImageId]
  );
  const analysisOutdated = hasAnalysis && analysisSourceKey !== currentAnalysisSourceKey;
  const orderedImages = useMemo(
    () => orderedSourceImages(sourceImages, primaryImageId),
    [sourceImages, primaryImageId]
  );
  const primaryPreviewUrl = orderedImages[0]?.previewUrl;
  const hiddenPlatforms = HIDDEN_PLATFORMS_BY_LOCALE[currentLocale] ?? [];
  const visibleRatios = isSimplifiedLocale
    ? SIMPLIFIED_RATIOS
    : showAllRatios
      ? RATIOS
      : PRIMARY_RATIOS;
  const localPlatformCodes = PLATFORM_LOCAL_ORDER[currentLocale] ?? [];
  const visiblePlatforms: TargetPlatform[] = showAllPlatforms
    ? ALL_PLATFORMS.filter((code) => !hiddenPlatforms.includes(code))
    : (['general', ...localPlatformCodes] as TargetPlatform[]);

  function handlePlatformChange(next: TargetPlatform) {
    setPlatform(next);
    const preset = PLATFORM_PRESETS[next];
    setAspectRatio(preset.ratio);
    setOutputLanguages(preset.languages);
    // 用户没用 stepper 手动改过 counts 时, 切换平台总是套用对应预设;
    // 一旦 stepper 动过 (hasManualCountEdits=true) 就保留用户手填, 不再覆盖
    if (preset.counts && !hasManualCountEdits) {
      setCounts((current) => ({
        ...current,
        selling: preset.counts?.selling ?? 0,
        white: preset.counts?.white ?? 0,
        scene: preset.counts?.scene ?? 0,
        closeup: preset.counts?.closeup ?? 0,
        closeup_white: preset.counts?.closeup_white ?? 0
      }));
    }
  }

  function toggleOutputLanguage(language: OutputLanguage) {
    setOutputLanguages((current) => {
      if (current.includes(language)) {
        return current.length > 1 ? current.filter((entry) => entry !== language) : current;
      }
      return [...current, language];
    });
  }
  const maxSourceImages = mode === 'model' ? MODEL_MAX_SOURCE_IMAGES : PRODUCT_MAX_SOURCE_IMAGES;
  const modeCopy = getModeCopy(currentLocale, mode);
  const versionOptions = [
    {
      value: 'nano-banana-2' as GenerationModel,
      label: messages.modelStandard,
      description: messages.modelStandardDescription
    },
    {
      value: 'nano-banana-pro' as GenerationModel,
      label: messages.modelPremium,
      description: messages.modelPremiumDescription
    },
    {
      value: 'gpt-image-pro' as GenerationModel,
      label: messages.modelPro,
      description: messages.modelProDescription
    }
  ];
  const selectedVersion = versionOptions.find((option) => option.value === model) ?? versionOptions[0];
  const showHelp = (id: string) => setActiveHelp(id);
  const hideHelp = (id: string) => setActiveHelp((current) => (current === id ? null : current));
  const toggleHelp = (id: string) => setActiveHelp((current) => (current === id ? null : id));
  const imageTypes: Array<{ kind: ImageKind; label: string; sub: string }> = (
    ['selling', 'white', 'scene', 'closeup', 'closeup_white'] as const
  ).map((kind) => ({
    kind,
    label: imageKindLabel(currentLocale, mode, kind),
    sub: modeCopy.imageTypeSubs[kind]
  }));

  useEffect(() => {
    if (activeHelp === null && !isVersionOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.field-help')) {
        return;
      }
      if (target instanceof Element && target.closest('.version-dropdown')) {
        return;
      }

      setActiveHelp(null);
      setIsVersionOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeHelp, isVersionOpen]);

  useEffect(() => {
    router.prefetch(`/${currentLocale}/task/preparing`);
    router.prefetch(`/${currentLocale}/result/preparing`);
  }, [currentLocale, router]);

  function setCount(kind: ImageKind, nextCount: number) {
    const usedByOtherTypes = Object.entries(counts).reduce(
      (sum, [entryKind, count]) => sum + (entryKind === kind ? 0 : count),
      0
    );
    const capped = Math.max(0, Math.min(MAX_PER_TYPE, Math.min(nextCount, MAX_PER_BATCH - usedByOtherTypes)));
    updateActiveDraft((draft) => ({
      counts: { ...draft.counts, [kind]: capped },
      hasManualCountEdits: true
    }));
  }

  async function uploadImage(image: LocalSourceImage) {
    if (image.uploadedUrl) {
      return image.uploadedUrl;
    }
    const formData = new FormData();
    formData.append('file', image.file);
    const uploadResponse = await fetch('/api/v1/upload', {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const data = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? messages.uploadFailed);
    }

    const data = (await uploadResponse.json()) as { upload: { url: string } };
    return data.upload.url;
  }

  async function ensureSourceImageUrls() {
    if (orderedImages.length < 1) {
      return [DEFAULT_PREVIEW_URL];
    }

    const uploadedUrls = await Promise.all(orderedImages.map((image) => uploadImage(image)));
    setSourceImages((current) =>
      current.map((image) => {
        const index = orderedImages.findIndex((orderedImage) => orderedImage.id === image.id);
        return index >= 0 ? { ...image, uploadedUrl: uploadedUrls[index] } : image;
      })
    );
    return uploadedUrls;
  }

  async function ensurePrimarySourceImageUrl() {
    const primaryImage = orderedImages[0];
    if (!primaryImage) {
      return undefined;
    }

    const uploadedUrl = await uploadImage(primaryImage);
    setSourceImages((current) =>
      current.map((image) => (image.id === primaryImage.id ? { ...image, uploadedUrl } : image))
    );
    return uploadedUrl;
  }

  function handleFilesSelected(files: FileList | null) {
    const nextFiles = Array.from(files ?? []).slice(0, Math.max(0, maxSourceImages - sourceImages.length));
    if (nextFiles.length < 1) {
      if ((files?.length ?? 0) > 0 && sourceImages.length >= maxSourceImages) {
        setError(modeCopy.maxImagesError);
      }
      return;
    }

    const nextImages = nextFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setSourceImages((current) => [...current, ...nextImages].slice(0, maxSourceImages));
    setPrimaryImageId((current) => current ?? nextImages[0]?.id ?? null);
    clearAnalysisState();
    setError((files?.length ?? 0) + sourceImages.length > maxSourceImages ? modeCopy.maxImagesError : null);
  }

  function removeSourceImage(imageId: string) {
    setSourceImages((current) => current.filter((image) => image.id !== imageId));
    setPrimaryImageId((current) => nextPrimaryImageIdAfterRemoval(sourceImages, imageId, current));
    clearAnalysisState();
  }

  function clearSourceImages() {
    setSourceImages([]);
    setPrimaryImageId(null);
    clearAnalysisState();
  }

  function setPrimaryImage(imageId: string) {
    setPrimaryImageId(imageId);
    clearAnalysisState();
  }

  function clearAnalysisState() {
    setAnalysis({ ...EMPTY_ANALYSIS });
    setAnalysisSourceKey(null);
    setAnalysisError(null);
  }

  function toggleQuickChip(group: QuickChipGroupKey, value: string) {
    updateActiveDraft((draft) => {
      const current = draft.selectedQuickChips[group];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return {
        selectedQuickChips: { ...draft.selectedQuickChips, [group]: next }
      };
    });
    setAnalysisError(null);
  }

  function buildProductInfoWithQuickChips(): string {
    return composeProductInfoWithQuickChips(productInfo, selectedQuickChips, {
      category: messages.quickChipsCategoryLabel,
      audience: messages.quickChipsAudienceLabel,
      style: messages.quickChipsStyleLabel
    });
  }

  async function handleAnalyze() {
    setAnalysisError(null);
    // chip 选择也作为上下文喂给 AI, 让分析针对正确的类目/受众/风格生成 brief
    const productInfoRaw = buildProductInfoWithQuickChips().trim();
    const hasUserInput =
      sourceImages.length > 0 || productInfo.trim().length > 0 || productInfoRaw.length > 0;

    if (!hasUserInput) {
      setAnalysisError(messages.analysisRequiresInput);
      return;
    }

    setIsAnalyzing(true);

    try {
      const sourceImageUrl = sourceImages.length > 0 ? await ensurePrimarySourceImageUrl() : undefined;
      const requestBody = JSON.stringify({ sourceImageUrl, productInfoRaw, locale: currentLocale, mode });
      const analyzeOnce = () =>
        fetch('/api/v1/analyze-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        });
      // 瞬时网络/上游(Qwen)抖动时 fetch 会直接 reject;自动重试一次,静默恢复,避免偶发直接报错
      let response: Response;
      try {
        response = await analyzeOnce();
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        response = await analyzeOnce();
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setAnalysisError(data?.error ?? messages.analysisFailed);
        return;
      }

      const data = (await response.json()) as { analysis: ProductAnalysis };
      const formatted = formatProductAnalysisForTextarea(data.analysis, mode, currentLocale);
      setProductInfo(formatted);
      setAnalysis(data.analysis);
      setAnalysisSourceKey(buildAnalysisSourceKey({
        productInfo: formatted,
        sourceImages,
        primaryImageId
      }));
    } catch {
      // 网络级失败(fetch reject:超时/连接断/上游慢)→ 显示本地化友好提示,而非裸露的 "Failed to fetch"
      setAnalysisError(messages.analysisFailed);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    // 未上传商品图:明确提示(toast + 内联)+ 高亮上传区并滚动到它,而非静默禁用
    if (orderedImages.length < 1) {
      setError(messages.uploadImageRequired);
      showToast(messages.uploadImageRequired, 'error');
      setHighlightUpload(true);
      window.setTimeout(() => setHighlightUpload(false), 2500);
      uploadFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (totalImages < 1) {
      setError(messages.chooseAtLeastOneImage);
      showToast(messages.chooseAtLeastOneImage, 'error');
      return;
    }

    setIsSubmitting(true);
    let sourceImageUrls = [DEFAULT_PREVIEW_URL];

    try {
      sourceImageUrls = await ensureSourceImageUrls();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : messages.uploadFailed);
      setIsSubmitting(false);
      return;
    }

    const languages = hasTextKinds
      ? outputLanguages.length > 0
        ? outputLanguages
        : [currentLocale]
      : [outputLanguages[0] ?? currentLocale];

    const basePayload = {
      sourceImageUrl: sourceImageUrls[0],
      sourceImageUrls,
      mode,
      platform,
      category: selectedQuickChips.category[0],
      productInfo: buildProductInfoWithQuickChips(),
      analysis: hasAnalysis && !analysisOutdated ? analysis : undefined,
      model,
      resolution,
      aspectRatio,
      fontStyle,
      // 整单总产出张数(= 单语言张数 × 语言数),让后端折扣按总产出判定而非单批
      batchTotalImages: billedImages,
      imageTypes: Object.entries(counts).map(([kind, count]) => ({ kind, count }))
    };

    // 用 billedImages(=张数×语言数)作为本单总额度/总价依据:多语言时每个语言各扣一套,
    // 实际消耗与 UI"总计"都按 billedImages;单语言时 billedImages===totalImages 不变。
    await dispatchGeneration(basePayload, languages, billedImages);
  }

  // 实际下发生成 + 处理结果。402(余额不足)时:先结算把刚付款的订单入账(幂等),到账够了就重试
  // 一次生成;仍不足才发起套餐支付(付款回跳后自动续生成)。attempt 限制只重试一次,防递归。
  async function dispatchGeneration(
    basePayload: Record<string, unknown>,
    languages: string[],
    total: number,
    attempt = 0
  ) {
    let responses: Response[];
    try {
      responses = await Promise.all(
        languages.map((language) =>
          fetch('/api/v1/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...basePayload, outputLanguage: language })
          })
        )
      );
    } catch {
      // 网络异常:别让按钮永久卡在 loading,给出可重试的错误提示
      setError(messages.generationFailed);
      showToast(messages.generationFailed, 'error');
      setIsSubmitting(false);
      return;
    }

    const failed = responses.find((res) => !res.ok);
    if (failed) {
      // 未登录:跳登录页(免费浏览,生成需登录)
      if (failed.status === 401) {
        try {
          localStorage.removeItem('aman_auth');
        } catch {
          /* 忽略 */
        }
        setIsSubmitting(false);
        router.push(`/${currentLocale}/login`);
        return;
      }
      // 余额不足
      if (failed.status === 402) {
        // 先结算:把刚付款的已付订单入账(幂等)。到账后余额够了就重试一次生成,不跳支付。
        // 仅当本次全部语言都失败(无一成功建任务)时才重试,否则多语言部分成功的会被重复生成+重复扣费。
        if (attempt === 0 && responses.every((res) => !res.ok)) {
          try {
            const res = await fetch('/api/v1/payments/settle', { method: 'POST' });
            const data = (await res.json().catch(() => null)) as { creditedCount?: number; balance?: number } | null;
            if (data && (data.creditedCount ?? 0) > 0) {
              window.dispatchEvent(new CustomEvent('aman:balance-changed'));
            }
            if (data && (data.balance ?? 0) >= total) {
              await dispatchGeneration(basePayload, languages, total, 1);
              return;
            }
          } catch {
            /* 忽略,继续走支付 */
          }
        }
        // 仍不足:存下待生成请求 → 建套餐订单 → 跳银行支付页;回跳结算入账后自动续生成。
        try {
          sessionStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify({ basePayload, languages, total }));
        } catch {
          /* 忽略 */
        }
        try {
          const orderRes = await fetch('/api/v1/payments/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: Math.min(Math.max(total, 1), 5), locale: currentLocale })
          });
          const orderData = (await orderRes.json().catch(() => null)) as { url?: string } | null;
          if (orderRes.ok && orderData?.url) {
            window.location.href = orderData.url;
            return;
          }
        } catch {
          /* 落到下面的兜底提示 */
        }
        // 建单/拿支付页失败(无 marketplace 会话、上游异常等):退回原充值提示
        try {
          sessionStorage.removeItem(PENDING_GENERATION_KEY);
        } catch {
          /* 忽略 */
        }
        setError(messages.insufficientBalance);
        showToast(messages.insufficientBalance, 'error');
        setIsSubmitting(false);
        return;
      }
      // 全部用前端本地化文案,不透传服务端原始英文串:422=内容被安全策略拒绝,其余=通用失败
      setError(failed.status === 422 ? messages.generationContentRejected : messages.generationFailed);
      setIsSubmitting(false);
      return;
    }

    // 成功:清掉待生成请求,跳转到任务/历史页
    try {
      sessionStorage.removeItem(PENDING_GENERATION_KEY);
    } catch {
      /* 忽略 */
    }
    const tasks = await Promise.all(
      responses.map(async (res) => ((await res.json()) as { task: { id: string } }).task)
    );

    if (tasks.length === 1) {
      router.push(`/${currentLocale}/task/${tasks[0].id}?count=${total}`);
    } else {
      try {
        // eslint-disable-next-line react-hooks/purity
        const ts = Date.now();
        sessionStorage.setItem(
          'tamga_recent_batch',
          JSON.stringify({ count: tasks.length, ts })
        );
      } catch {
        // sessionStorage unavailable; banner just won't show
      }
      router.push(`/${currentLocale}/history`);
    }
  }

  // 底栏「创建」在 /app 点击 → SiteShell 派 'aman:create-tap' 事件,这里触发生成(保留移动端校验能力)
  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });
  useEffect(() => {
    const onTap = () => submitRef.current();
    window.addEventListener('aman:create-tap', onTap);
    return () => window.removeEventListener('aman:create-tap', onTap);
  }, []);

  // 付款回跳后:结算入账(幂等)+ 用存下的请求自动续生成,无需重新上传/重选。仅触发一次。
  // 处理后立即抹掉 URL 上的 ?payment=success,避免刷新/返回重复触发(防止旧版"卡住"问题)。
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    const paid = new URLSearchParams(window.location.search).get('payment') === 'success';
    if (!paid) return;
    resumedRef.current = true;
    let pending: { basePayload: Record<string, unknown>; languages: string[]; total: number } | null = null;
    try {
      const raw = sessionStorage.getItem(PENDING_GENERATION_KEY);
      pending = raw ? JSON.parse(raw) : null;
    } catch {
      pending = null;
    }
    setIsSubmitting(Boolean(pending));
    void (async () => {
      // 先结算把已付订单入账(幂等),刷新头部余额
      try {
        await fetch('/api/v1/payments/settle', { method: 'POST' });
        window.dispatchEvent(new CustomEvent('aman:balance-changed'));
      } catch {
        /* 忽略;dispatchGeneration 仍会按余额情况处理 */
      }
      // 抹掉 ?payment=success,避免刷新重复触发结算/续生成
      try {
        router.replace(`/${currentLocale}/app`);
      } catch {
        /* 忽略 */
      }
      // 有待生成请求(付款前点过创建)→ 自动续发;余额已到账则直接生成,否则其内部会再结算/按需支付
      if (pending && Array.isArray(pending.languages)) {
        await dispatchGeneration(pending.basePayload, pending.languages, pending.total);
      } else {
        setIsSubmitting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
        <CreateGate locale={currentLocale}>
        <div className="app-grid">
          <aside className="panel sticky">
            <div className="mode-tabs" aria-label={modeCopy.modeLabel}>
              <button className={`chip ${mode === 'product' ? 'active' : ''}`} type="button" onClick={() => setMode('product')}>
                {modeCopy.productMode}
              </button>
              <button className={`chip ${mode === 'model' ? 'active' : ''}`} type="button" onClick={() => setMode('model')}>
                {modeCopy.modelMode}
              </button>
            </div>
            <div className={`field ${highlightUpload ? 'upload-alert' : ''}`} ref={uploadFieldRef}>
              <span className="label">{modeCopy.imageLabel}</span>
              {sourceImages.length === 0 ? (
                <label htmlFor={fileInputId} style={{ display: 'block', cursor: 'pointer' }}>
                  <ProductPreview src={primaryPreviewUrl} label={modeCopy.sourceLabel} alt={messages.uploadedProductPreview} />
                  <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="upload-choose-btn" style={{ pointerEvents: 'none' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                      </svg>
                      {messages.chooseFile}
                    </span>
                    <span className="muted upload-file-meta">{messages.noFileSelected}</span>
                  </div>
                </label>
              ) : (
                <>
                  <button
                    type="button"
                    className="upload-preview-clickable"
                    style={{ display: 'block', padding: 0, border: 0, background: 'transparent', width: '100%', cursor: 'zoom-in' }}
                    onClick={() => setLightboxIndex(0)}
                    aria-label={messages.uploadedProductPreview}
                  >
                    <ProductPreview src={primaryPreviewUrl} label={modeCopy.sourceLabel} alt={messages.uploadedProductPreview} />
                  </button>
                  <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <label htmlFor={fileInputId} className="upload-choose-btn" style={{ cursor: 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                      </svg>
                      {messages.chooseFile}
                    </label>
                    <span className="muted upload-file-meta">{modeCopy.uploadHint}</span>
                  </div>
                </>
              )}
              <p className="muted" style={{ marginTop: 0 }}>{modeCopy.uploadHint}</p>
              {sourceImages.length > 0 ? (
                <div className="source-image-grid">
                  {sourceImages.map((image, index) => {
                    const isPrimary = image.id === (primaryImageId ?? sourceImages[0]?.id);
                    const orderedIndex = orderedImages.findIndex((entry) => entry.id === image.id);
                    return (
                      <div key={image.id} className={`source-image-card ${isPrimary ? 'active' : ''}`}>
                        <img
                          src={image.previewUrl}
                          alt={isPrimary ? messages.primaryImage : messages.referenceImage}
                          style={{ cursor: 'zoom-in' }}
                          onClick={() => setLightboxIndex(orderedIndex >= 0 ? orderedIndex : index)}
                        />
                        <div className="source-image-meta">
                          <b>{isPrimary ? messages.primaryImage : messages.referenceImage}</b>
                          <span>{image.file.name}</span>
                        </div>
                        <div className="source-image-actions">
                          {!isPrimary ? (
                            <button type="button" onClick={() => setPrimaryImage(image.id)}>
                              {messages.setAsPrimaryImage}
                            </button>
                          ) : null}
                          <button type="button" onClick={() => removeSourceImage(image.id)}>
                            {messages.removeImage}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {sourceImages.length > 0 ? (
                <button className="chip" type="button" onClick={clearSourceImages}>
                  {messages.clearImages}
                </button>
              ) : null}
              <input
                id={fileInputId}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={(event) => {
                  handleFilesSelected(event.currentTarget.files);
                  event.currentTarget.value = '';
                }}
              />
            </div>

            <div className="field">
              <div className="field-label-row">
                <span className="label">{modeCopy.productInfoLabel}</span>
                <HelpTip
                  id="product-info"
                  title={modeCopy.productInfoHelpTitle}
                  body={modeCopy.productInfoHelp}
                  activeHelp={activeHelp}
                  showHelp={showHelp}
                  hideHelp={hideHelp}
                  toggleHelp={toggleHelp}
                />
              </div>
              <div className="quick-chips">
                <QuickChipGroup
                  label={messages.quickChipsCategoryLabel}
                  values={messages.quickChipsCategories}
                  selected={selectedQuickChips.category}
                  onToggle={(value) => toggleQuickChip('category', value)}
                />
                <QuickChipGroup
                  label={messages.quickChipsAudienceLabel}
                  values={messages.quickChipsAudiences}
                  selected={selectedQuickChips.audience}
                  onToggle={(value) => toggleQuickChip('audience', value)}
                />
                <QuickChipGroup
                  label={messages.quickChipsStyleLabel}
                  values={messages.quickChipsStyles}
                  selected={selectedQuickChips.style}
                  onToggle={(value) => toggleQuickChip('style', value)}
                />
              </div>
              <div className="product-info-editor">
                <textarea
                  className="textarea product-info-textarea"
                  value={productInfo}
                  placeholder={modeCopy.infoPlaceholder}
                  maxLength={2000}
                  onChange={(event) => {
                    setProductInfo(event.target.value);
                  }}
                />
                {productInfo.length > 0 ? (
                  <button
                    className="product-info-clear"
                    type="button"
                    aria-label={messages.clearProductInfo}
                    title={messages.clearProductInfo}
                    onClick={() => {
                      setProductInfo('');
                      setAnalysisError(null);
                    }}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                ) : null}
                <div className="product-info-toolbar">
                  <button
                    className="analysis-inline-button"
                    type="button"
                    disabled={isAnalyzing}
                    onClick={handleAnalyze}
                  >
                    {isAnalyzing ? <LoadingButtonText text={messages.analyzingWithAi} /> : hasAnalysis ? messages.reanalyzeWithAi : messages.analyzeWithAi}
                  </button>
                  <HelpTip
                    id="analysis"
                    title={modeCopy.analysisHelpTitle}
                    body={modeCopy.analysisHelp}
                    activeHelp={activeHelp}
                    showHelp={showHelp}
                    hideHelp={hideHelp}
                    toggleHelp={toggleHelp}
                  />
                  <span className="product-info-count">{productInfo.length}/2000</span>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 0 }}>{modeCopy.aiHint}</p>
              {analysisOutdated ? <p className="muted">{messages.analysisOutdated}</p> : null}
              {analysisError ? <p style={{ color: 'var(--red-dark)' }}>{analysisError}</p> : null}
            </div>

          </aside>

          <section className="workspace">
            <div className="panel preview-card">
              <div>
                <div className="generation-settings">
                  <div className="field">
                    <span className="label">{messages.resolution}</span>
                    <div className="segmented">
                      {RESOLUTIONS.map((value) => (
                        <button key={value} className={`chip ${resolution === value ? 'active' : ''}`} onClick={() => setResolution(value)}>
                          {value.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <span className="label">{messages.imageTypes}</span>
                    <p className="muted" style={{ marginTop: 0 }}>
                      {messages.imageTypesHint} ({totalImages}/{MAX_PER_BATCH})
                    </p>
                    <div className="type-list">
                      {imageTypes.map((type) => {
                        const badge = modeCopy.imageTypeBadges[type.kind];
                        // sub 可能含 \n (例如 scene 的 "How the product looks...\nExample: mug → on a table")
                        // 按客户文档拆成多行渲染
                        const subLines = type.sub.split('\n');
                        return (
                          <div key={type.kind} className={`type-row ${counts[type.kind] > 0 ? 'active' : ''}`}>
                            <div className="type-row-text">
                              <b>{type.label}</b>
                              <div className="muted">
                                {subLines.map((line, idx) => (
                                  <div key={idx}>{line}</div>
                                ))}
                              </div>
                              {badge ? <span className="type-row-badge">{badge}</span> : null}
                            </div>
                            <div className="stepper">
                              <button onClick={() => setCount(type.kind, counts[type.kind] - 1)}>-</button>
                              <span>{counts[type.kind]}</span>
                              <button onClick={() => setCount(type.kind, counts[type.kind] + 1)}>+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                {SHOW_MODEL_PICKER ? (
                  <div className="field">
                    <span className="label">{messages.model}</span>
                    <div className={`version-dropdown ${isVersionOpen ? 'open' : ''}`}>
                      <button
                        className="select version-select version-trigger"
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={isVersionOpen}
                        onClick={() => setIsVersionOpen((current) => !current)}
                      >
                        <span className="version-selected">{selectedVersion.label}</span>
                        <span className="version-chevron" aria-hidden="true">⌄</span>
                      </button>
                      {isVersionOpen ? (
                        <div className="version-menu" role="listbox" aria-label={messages.model}>
                          {versionOptions.map((option) => (
                            <button
                              key={option.value}
                              className={`version-option ${model === option.value ? 'active' : ''}`}
                              type="button"
                              role="option"
                              aria-selected={model === option.value}
                              onClick={() => {
                                setModel(option.value);
                                setIsVersionOpen(false);
                              }}
                            >
                              <b>{option.label}</b>
                              <span>{option.description}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="field">
                  <span className="label">{messages.targetPlatform}</span>
                  <div className="chip-grid">
                    {visiblePlatforms.map((code) => {
                      const isLocal = code !== 'general' && localPlatformCodes.includes(code as TargetPlatformCode);
                      return (
                        <button
                          key={code}
                          type="button"
                          className={`chip ${platform === code ? 'active' : ''}`}
                          onClick={() => handlePlatformChange(code)}
                          title={isLocal ? messages.platformLocalRecommendation : undefined}
                        >
                          {platformLabel(currentLocale, code as TargetPlatformCode)}
                        </button>
                      );
                    })}
                    <button
                      className="chip ratio-more"
                      type="button"
                      onClick={() => setShowAllPlatforms((current) => !current)}
                    >
                      {showAllPlatforms ? messages.fewerPlatforms : messages.morePlatforms}
                    </button>
                  </div>
                  <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>{messages.targetPlatformHint}</p>
                </div>
                <div className="field">
                  <span className="label">{messages.aspectRatio}</span>
                  <div className="chip-grid ratio-grid">
                    {visibleRatios.map((ratio) => {
                      const sub = modeCopy.aspectSubs[ratio];
                      const prefix = modeCopy.aspectPrefix?.[ratio];
                      return (
                        <button
                          key={ratio}
                          className={`chip ratio-chip ${aspectRatio === ratio ? 'active' : ''}`}
                          onClick={() => setAspectRatio(ratio)}
                        >
                          <span className="ratio-chip-value">{prefix ? `${prefix} ${ratio}` : ratio}</span>
                          {sub ? <span className="ratio-chip-sub">{sub}</span> : null}
                        </button>
                      );
                    })}
                    {isSimplifiedLocale ? null : (
                      <button className="chip ratio-more" type="button" onClick={() => setShowAllRatios((current) => !current)}>
                        {showAllRatios ? messages.fewerAspectRatios : messages.moreAspectRatios}
                      </button>
                    )}
                  </div>
                </div>
                {hasTextKinds ? (
                  <div className="field">
                    <span className="label">{messages.imageLanguage}</span>
                    <div className="chip-grid">
                      {LANGUAGES.map((language) => (
                        <button
                          key={language}
                          type="button"
                          className={`chip ${outputLanguages.includes(language) ? 'active' : ''}`}
                          onClick={() => toggleOutputLanguage(language)}
                        >
                          {outputLanguageLabel(language)}
                        </button>
                      ))}
                    </div>
                    <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>{messages.imageLanguageMultiHint}</p>
                  </div>
                ) : null}
                {showFontStylePicker && hasTextKinds ? (
                  <div className="field">
                    <span className="label">{messages.fontStyle}</span>
                    <select className="select" value={fontStyle} onChange={(event) => setFontStyle(event.target.value as FontStyle)}>
                      {FONT_STYLES.map((style) => (
                        <option key={style} value={style}>
                          {fontStyleLabel(currentLocale, style)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {error ? <p style={{ color: 'var(--red-dark)' }}>{error}</p> : null}
                <div className="cost-summary">
                  <span className="muted">
                    {messages.imageCountLabel}: <b style={{ color: 'var(--ink)' }}>{billedImages}</b>
                  </span>
                  <span className="cost-total">
                    {messages.totalCostLabel}: {priceForCount(billedImages)} {messages.currencyTenge}
                  </span>
                </div>
                <button className={`button primary ${isSubmitting ? 'loading' : ''}`} style={{ width: '100%', justifyContent: 'center' }} disabled={isSubmitting} onClick={handleSubmit}>
                  {isSubmitting ? (
                    <LoadingButtonText
                      text={messages.creatingTask(
                        platform === 'general'
                          ? messages.creatingTaskTargetAll
                          : platformLabel(currentLocale, platform)
                      )}
                    />
                  ) : (
                    messages.generateImages(totalImages)
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
        </CreateGate>
      {lightboxIndex !== null && orderedImages.length > 0 ? (
        <ImageLightbox
          items={orderedImages.map<LightboxItem>((image, index) => ({
            url: image.previewUrl,
            alt: image.file.name,
            caption: `${index + 1} / ${orderedImages.length} · ${image.file.name}`
          }))}
          activeIndex={Math.min(lightboxIndex, orderedImages.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </>
  );
}

function QuickChipGroup({
  label,
  values,
  selected,
  onToggle
}: {
  label: string;
  values: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="quick-chip-group">
      <span className="quick-chip-label muted">{label}</span>
      <div className="quick-chip-list">
        {values.map((value) => {
          const isActive = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              className={`chip quick-chip ${isActive ? 'active' : ''}`}
              aria-pressed={isActive}
              onClick={() => onToggle(value)}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HelpTip({
  id,
  title,
  body,
  activeHelp,
  showHelp,
  hideHelp,
  toggleHelp
}: {
  id: string;
  title: string;
  body: string;
  activeHelp: string | null;
  showHelp: (id: string) => void;
  hideHelp: (id: string) => void;
  toggleHelp: (id: string) => void;
}) {
  const isOpen = activeHelp === id;

  return (
    <span
      className={`field-help ${isOpen ? 'open' : ''}`}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          showHelp(id);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') {
          hideHelp(id);
        }
      }}
    >
      <button
        className="field-help-button"
        type="button"
        aria-label={title}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.preventDefault();
          toggleHelp(id);
        }}
      >
        ?
      </button>
      {isOpen ? <p role="tooltip">{body}</p> : null}
    </span>
  );
}

function LoadingButtonText({ text }: { text: string }) {
  const label = text.replace(/(?:\.{3}|…)$/u, '');

  return (
    <span className="button-loading-label">
      {label}
      <span className="loading-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

function ProductPreview({
  src,
  label,
  alt
}: {
  src?: string;
  label: string;
  alt: string;
}) {
  if (src) {
    return <img className="upload-preview" src={src} alt={alt} />;
  }

  return (
    <div className="upload-preview source-product-placeholder" role="img" aria-label={alt}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="9" y="14" width="46" height="36" rx="6" fill="none" stroke="#b9b2aa" strokeWidth="3" />
        <circle cx="22" cy="27" r="4.5" fill="#b9b2aa" />
        <path d="M14 46l11-11 7 7 9-10 9 9" fill="none" stroke="#b9b2aa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <b>{label}</b>
    </div>
  );
}

function getModeCopy(locale: ReturnType<typeof resolveLocale>, mode: GenerationMode): ModeCopy {
  const product = {
    zh: {
      modeLabel: '生成分类',
      productMode: '商品图',
      modelMode: '模特图',
      imageLabel: '商品图片',
      sourceLabel: '点击上传商品图',
      uploadHint: '上传最多 5 张商品图',
      maxImagesError: '最多上传 5 张商品图。',
      productInfoLabel: '商品描述',
      infoPlaceholder: '示例：女款白色运动鞋，轻便，适合日常穿着，36–40 码。或：儿童玩具，安全材质，3+ 岁。',
      aiHint: 'AI 会根据图片和文字整理商品信息，生成前你可以继续修改。',
      productInfoHelpTitle: '查看商品信息示例',
      productInfoHelp:
        '卖点描述举例：（参考内容结构即可）\n\n商品卖点：\n1、安全耐用：这款手推车是一款安全耐用的玩具。车身采用ABS环保材质，抗摔抗撞，坚固耐用，不易变形。\n2、手眼协调：滚动车轮作为益智早教玩具，能有效培养幼儿手眼协调能力、平衡感及色彩认知能力\n3、脑力开发：按压推进式设计激发儿童好奇心，提升思维能力，鼓励孩子通过小车探索周围环境\n4、萌趣造型：按钮小车采用可爱动物造型。童趣化外观设计，搭配生动笑脸表情，轻松吸引宝宝注意力\n\n使用场景：\n1. 居家及室内玩耍；2. 携带与送礼；3. 深夜温馨陪伴\n\n使用方法：\n1. 推行/手动滑行；2. 惯性回力/后拉滑行',
      analysisHelpTitle: 'AI 自动填写说明',
      analysisHelp: 'AI 会根据图片自动填写商品描述。',
      imageTypeSubs: {
        selling: '主图 + 商品卖点',
        white: 'Kaspi 和 Wildberries 标准图',
        scene: '商品在真实场景中的样子\n示例：杯子 → 摆在桌上',
        closeup: '材质、质量、纹理',
        closeup_white: '目录所需的关键细节'
      },
      imageTypeBadges: {},
      aspectSubs: {
        '1:1': 'Kaspi / Wildberries',
        '3:4': '商品卡片',
        '9:16': 'Stories / TikTok'
      }
    },
    ru: {
      modeLabel: 'Тип генерации',
      productMode: 'Товар',
      modelMode: 'На модели',
      imageLabel: 'Изображение товара',
      sourceLabel: 'Нажмите, чтобы загрузить',
      uploadHint: 'Загрузите до 5 фото товара',
      maxImagesError: 'Можно загрузить не больше 5 изображений товара.',
      productInfoLabel: 'Описание товара',
      infoPlaceholder: 'Пример: Белые женские кроссовки, лёгкие, для повседневной носки, размеры 36–40. Или: Детская игрушка, безопасный материал, возраст 3+.',
      aiHint: 'AI аккуратно заполнит описание по фото и вашему тексту.',
      productInfoHelpTitle: 'Пример описания товара',
      productInfoHelp:
        'Пример структуры преимуществ:\n\nПреимущества товара:\n1. Безопасность и долговечность: корпус из экологичного ABS-пластика, устойчив к ударам и не деформируется при обычном использовании.\n2. Координация рук и глаз: катящиеся колёса помогают развивать моторику, баланс и распознавание цветов.\n3. Развитие мышления: нажимной механизм вызывает интерес ребёнка и побуждает исследовать пространство.\n4. Милый дизайн: форма с дружелюбным персонажем быстро привлекает внимание малыша.\n\nСценарии использования:\n1. Игры дома и в помещении; 2. Подарок или игрушка в дорогу; 3. Спокойное вечернее сопровождение.\n\nКак использовать:\n1. Катать рукой; 2. Использовать инерционное движение после оттягивания.',
      analysisHelpTitle: 'AI автозаполнение',
      analysisHelp: 'AI автоматически заполняет описание на основе фото.',
      imageTypeSubs: {
        selling: 'Главное фото + преимущество товара',
        white: 'Стандартное фото для Kaspi и Wildberries',
        scene: 'Как товар выглядит в реальной жизни\nПример: кружка → на столе',
        closeup: 'Материал, качество, текстура',
        closeup_white: 'Важные части для каталога'
      },
      imageTypeBadges: {},
      aspectSubs: {
        '1:1': 'Kaspi / Wildberries',
        '3:4': 'Карточка товара',
        '9:16': 'Stories / TikTok'
      }
    },
    kk: {
      modeLabel: 'Генерация түрі',
      productMode: 'Тауар',
      modelMode: 'Модельмен',
      imageLabel: 'Тауар суреті',
      sourceLabel: 'Жүктеу үшін басыңыз',
      // 客户原文 "Upload up to 5 product photos" - 加上 тауар (product)
      uploadHint: '5 тауар суретіне дейін жүктеңіз',
      maxImagesError: 'Ең көбі 5 тауар суретін жүктеуге болады.',
      productInfoLabel: 'Тауар сипаттамасы',
      infoPlaceholder: 'Мысалы: Ақ түсті әйелдер кроссовкасы, жеңіл, күнделікті киюге, 36–40 өлшем. Немесе: Балалар ойыншығы, қауіпсіз материал, 3+ жас.',
      aiHint: 'AI сурет пен мәтінге сүйеніп, сипаттаманы жинақы түрде толтырады.',
      productInfoHelpTitle: 'Тауар сипаттамасының мысалы',
      productInfoHelp:
        'Сату артықшылықтарының үлгісі:\n\nТауар артықшылықтары:\n1. Қауіпсіз әрі берік: корпус экологиялық ABS материалынан жасалған, соққыға төзімді және оңай майыспайды.\n2. Қол-көз үйлесімі: дөңгелекті ойыншық баланың ұсақ моторикасын, тепе-теңдік сезімін және түстерді тануын дамытуға көмектеседі.\n3. Ойлау қабілеті: басып жүргізу механикасы баланың қызығушылығын оятып, айналаны зерттеуге ынталандырады.\n4. Сүйкімді пішін: көңілді кейіпкер бейнесі мен жылы жүзді дизайны баланың назарын оңай аударады.\n\nҚолдану сценарийі:\n1. Үйде және бөлмеде ойнау; 2. Жолға алып жүру немесе сыйлыққа беру; 3. Кешкі тыныш ойын.\n\nҚолдану тәсілі:\n1. Қолмен итеріп жүргізу; 2. Артқа тартып, инерциямен жүргізу.',
      analysisHelpTitle: 'AI автотолтыру',
      analysisHelp: 'AI фотоға қарап сипаттаманы автоматты толтырады.',
      imageTypeSubs: {
        selling: 'Негізгі фото + тауардың артықшылығы',
        white: 'Kaspi мен Wildberries үшін стандарт фото',
        scene: 'Тауар нақты өмірде қалай көрінеді\nМысалы: кружка → үстелде',
        closeup: 'Материал, сапа, текстура',
        closeup_white: 'Каталогқа маңызды бөлшектер'
      },
      imageTypeBadges: {},
      aspectSubs: {
        '1:1': 'Kaspi / Wildberries',
        '3:4': 'Тауар карточкасы',
        '9:16': 'Stories / TikTok'
      }
    },
    en: {
      modeLabel: 'Generation category',
      productMode: 'Product images',
      modelMode: 'Model images',
      imageLabel: 'Product image',
      sourceLabel: 'Click to upload',
      // 客户原文 "Upload up to 5 product photos"
      uploadHint: 'Upload up to 5 product photos',
      maxImagesError: 'You can upload up to 5 product images.',
      productInfoLabel: 'Product description',
      infoPlaceholder: 'Example: White women’s sneakers, lightweight, for everyday wear, sizes 36–40. Or: Children’s toy, safe material, age 3+.',
      aiHint: 'AI fills a clean product brief from your images and text.',
      productInfoHelpTitle: 'Product info example',
      productInfoHelp:
        'Selling point example. Use this structure as a reference.\n\nProduct selling points:\n1. Safe and durable: made with eco-friendly ABS, impact-resistant, sturdy, and hard to deform.\n2. Hand-eye coordination: rolling wheels help children practice coordination, balance, and color recognition.\n3. Early learning: push-and-go play encourages curiosity and helps children explore their surroundings.\n4. Friendly shape: a cute character look with a bright expression quickly catches a child’s attention.\n\nUse scenarios:\n1. Home and indoor play; 2. Travel or gifting; 3. Calm evening companionship.\n\nHow to use:\n1. Push by hand; 2. Pull back and release for inertia play.',
      analysisHelpTitle: 'AI auto-fill',
      analysisHelp: 'AI automatically fills the description based on the photo.',
      imageTypeSubs: {
        selling: 'Main photo + product benefits',
        white: 'Standard photo for Kaspi and Wildberries',
        scene: 'How the product looks in real life\nExample: mug → on a table',
        closeup: 'Material, quality, texture',
        closeup_white: 'Important parts for catalog'
      },
      imageTypeBadges: {},
      aspectSubs: {
        '1:1': 'Kaspi / Wildberries',
        '3:4': 'Product card',
        '9:16': 'Stories / TikTok'
      }
    }
  } satisfies Record<string, ModeCopy>;

  const model = {
    zh: {
      ...product.zh,
      imageLabel: '服装图片',
      sourceLabel: '点击上传服装图',
      // 客户原文 "Upload up to 6 photos" - 不加"服装"限定
      uploadHint: '上传最多 6 张照片',
      maxImagesError: '最多上传 6 张服装图。',
      productInfoLabel: '服装描述',
      infoPlaceholder: '示例：女款宽松卫衣，面料柔软，休闲风格，适合日常穿着。',
      aiHint: 'AI 会按基础档案、工艺细节、功能性、穿搭方案和核心营销卖点整理服装信息。',
      productInfoHelpTitle: '查看服装信息示例',
      productInfoHelp:
        '卖点描述举例：（参考内容结构即可）\n\n款式品类：\n男士户外机能工装裤/战术徒步长裤\n面料：\n高强度尼龙，表面经过持久防泼水（DWR）处理。\n模特/销售地区：\n金发，欧美男模特，青年\n商品卖点：\n透气防水：轻薄型合成纤维结构，具备优异的透气性和导湿排汗能力，适合温热及潮湿环境穿着。\n面料回弹力：加入了氨纶混纺，确保活动中的灵活度，提供无束缚的动态适应性。\n耐用与打理：高耐磨损尼龙面料保证了极佳的户外耐久性；DWR处理不仅防水，同时具备轻微抗污渍能力。\n季节适应性：质地轻盈，适合春夏秋三季作为外穿单品，是户外徒步和城市通勤的理想选择。\n使用场景：\n最佳场景：户外徒步、轻装探险、城市机能通勤、轻量型战术训练。\n风格定位：实用机能风 / 城市户外（Gorpcore） / 战术简约主义。',
      analysisHelpTitle: 'AI 自动填写说明',
      analysisHelp: 'AI 会根据图片自动填写服装描述。',
      imageTypeSubs: {
        selling: '主推图',
        white: '标准目录图',
        scene: '街拍、咖啡馆、居家',
        closeup: '材质、质量、走线',
        closeup_white: 'Logo、面料、配饰'
      },
      // 客户 model 模式 FORMAT 用 "Kaspi / WB" 短称, 且无尾 (因为 prefix 已加)
      aspectSubs: { '1:1': 'Kaspi / WB', '3:4': '商品卡片', '9:16': 'Stories / TikTok' },
    },
    ru: {
      ...product.ru,
      imageLabel: 'Фото одежды',
      sourceLabel: 'Нажмите, чтобы загрузить одежду',
      // 客户原文 "Upload up to 6 photos" - 不加"одежды"限定
      uploadHint: 'Загрузите до 6 фото',
      maxImagesError: 'Можно загрузить не больше 6 фото одежды.',
      productInfoLabel: 'Описание одежды',
      infoPlaceholder: 'Пример: Женское оверсайз худи, мягкая ткань, повседневный стиль, подходит для каждого дня.',
      aiHint: 'AI оформит brief по базовому профилю, деталям кроя, функциям, стилизации и ключевым маркетинговым тезисам.',
      productInfoHelpTitle: 'Пример описания одежды',
      productInfoHelp:
        'Пример структуры преимуществ:\n\nТип модели:\nМужские outdoor utility pants / тактические треккинговые брюки.\nТкань:\nПрочный нейлон с долговременной водоотталкивающей обработкой DWR.\nМодель/регион продаж:\nМолодой европейский мужской модель, светлые волосы.\nПреимущества:\nДышащая защита от влаги: лёгкая синтетическая ткань хорошо отводит влагу и подходит для тёплой или влажной погоды.\nЭластичность: добавление спандекса сохраняет свободу движения.\nДолговечность и уход: износостойкий нейлон подходит для outdoor-сценариев, а DWR помогает отталкивать влагу и лёгкие загрязнения.\nСезонность: лёгкая фактура подходит для весны, лета и осени.\nСценарии:\nПоходы, лёгкие экспедиции, городской commute в outdoor-стиле, тактические тренировки.\nСтиль: утилитарный outdoor / Gorpcore / минималистичный tactical.',
      analysisHelpTitle: 'AI автозаполнение',
      analysisHelp: 'AI автоматически заполняет описание одежды на основе фото.',
      imageTypeSubs: {
        selling: 'Главная продающая картинка',
        white: 'Стандартное каталожное фото',
        scene: 'Улица, кафе, дом',
        closeup: 'Материал, качество, швы',
        closeup_white: 'Лого, ткань, аксессуары'
      },
      aspectSubs: { '1:1': 'Kaspi / WB', '3:4': 'Карточка товара', '9:16': 'Stories / TikTok' },
    },
    kk: {
      ...product.kk,
      imageLabel: 'Киім суреті',
      // 客户原文 "Click to upload clothing" - 加 "Киімді"
      sourceLabel: 'Киімді жүктеу үшін басыңыз',
      // 客户原文 "Upload up to 6 photos" - 不加"киім"限定
      uploadHint: '6 суретке дейін жүктеңіз',
      maxImagesError: 'Ең көбі 6 киім суретін жүктеуге болады.',
      productInfoLabel: 'Киім сипаттамасы',
      infoPlaceholder: 'Мысалы: Әйелдерге арналған оверсайз худи, жұмсақ мата, күнделікті стиль, күнде киюге қолайлы.',
      aiHint: 'AI базалық сипаттама, тігіс/материал бөлшектері, функция, образ және негізгі маркетингтік ойлар бойынша brief дайындайды.',
      productInfoHelpTitle: 'Киім сипаттамасының мысалы',
      productInfoHelp:
        'Сату артықшылықтарының үлгісі:\n\nКиім түрі:\nЕрлерге арналған outdoor utility pants / тактикалық треккинг шалбары.\nМата:\nБеріктігі жоғары нейлон, беті ұзақ әсерлі DWR су тебетін өңдеуден өткен.\nМодель/сату өңірі:\nАқшыл шашты жас еуропалық ер модель.\nАртықшылықтары:\nТыныс алатын әрі ылғалдан қорғайтын: жеңіл синтетикалық мата ылғалды жақсы шығарады, жылы және ылғалды ауа райына ыңғайлы.\nСерпімділік: спандекс қоспасы қозғалыс еркіндігін сақтайды.\nТөзімділік және күтім: тозуға төзімді нейлон outdoor қолдануға лайық, DWR жеңіл кір мен ылғалды тебуге көмектеседі.\nМаусымдылық: жеңіл фактура көктем, жаз және күзге қолайлы.\nҚолдану сценарийі:\nЖаяу серуен, жеңіл экспедиция, қалалық outdoor стиль, тактикалық жаттығу.\nСтиль: практикалық outdoor / Gorpcore / минималистік tactical.',
      analysisHelpTitle: 'AI автотолтыру',
      analysisHelp: 'AI фотоға қарап киім сипаттамасын автоматты толтырады.',
      imageTypeSubs: {
        selling: 'Негізгі сату суреті',
        white: 'Стандарт каталог фото',
        scene: 'Көше, кафе, үй',
        closeup: 'Материал, сапа, тігістер',
        closeup_white: 'Лого, мата, аксессуарлар'
      },
      aspectSubs: { '1:1': 'Kaspi / WB', '3:4': 'Тауар карточкасы', '9:16': 'Stories / TikTok' },
    },
    en: {
      ...product.en,
      // 客户原文 "Clothing photos"
      imageLabel: 'Clothing photos',
      // 客户原文 "Click to upload clothing"
      sourceLabel: 'Click to upload clothing',
      // 客户原文 "Upload up to 6 photos"
      uploadHint: 'Upload up to 6 photos',
      maxImagesError: 'You can upload up to 6 apparel images.',
      productInfoLabel: 'Clothing description',
      infoPlaceholder: 'Example: Women’s oversized hoodie, soft fabric, casual style, suitable for everyday wear.',
      aiHint: 'AI structures apparel details into profile, construction, function, styling ideas, and marketing points.',
      productInfoHelpTitle: 'Apparel info example',
      productInfoHelp:
        'Selling point example. Use this structure as a reference.\n\nStyle category:\nMen’s outdoor utility pants / tactical trekking pants.\nFabric:\nHigh-strength nylon with a durable water-repellent DWR finish.\nModel / sales region:\nYoung blond Western male model.\nSelling points:\nBreathable water resistance: lightweight synthetic fibers provide good breathability and moisture transfer for warm or humid conditions.\nFabric recovery: blended spandex keeps movement flexible and unrestricted.\nDurability and care: abrasion-resistant nylon supports outdoor use; DWR helps repel light moisture and minor stains.\nSeasonal fit: lightweight texture works well for spring, summer, and autumn.\nUse scenarios:\nBest for hiking, light exploration, urban outdoor commuting, and light tactical training.\nStyle direction: functional outdoor / Gorpcore / minimal tactical.',
      analysisHelpTitle: 'AI auto-fill',
      analysisHelp: 'AI automatically fills the clothing description based on the photo.',
      imageTypeSubs: {
        selling: 'Main selling image',
        white: 'Standard catalog photo',
        scene: 'Street, café, home',
        closeup: 'Material, quality, seams',
        closeup_white: 'Logo, fabric, accessories'
      },
      aspectSubs: { '1:1': 'Kaspi / WB', '3:4': 'Product card', '9:16': 'Stories / TikTok' },
    }
  } satisfies Record<string, ModeCopy>;

  return mode === 'model' ? model[locale] : product[locale];
}

type ModeCopy = {
  modeLabel: string;
  productMode: string;
  modelMode: string;
  imageLabel: string;
  sourceLabel: string;
  uploadHint: string;
  maxImagesError: string;
  productInfoLabel: string;
  infoPlaceholder: string;
  aiHint: string;
  productInfoHelpTitle: string;
  productInfoHelp: string;
  analysisHelpTitle: string;
  analysisHelp: string;
  imageTypeSubs: Record<ImageKind, string>;
  imageTypeBadges: Partial<Record<ImageKind, string>>;
  aspectSubs: Partial<Record<AspectRatio, string>>;
  // 客户文档 model 模式 FORMAT 章节明确写了: 1:1 / 3:4 / 9:16
  // 同屏 emoji 复用 (也用于白底图类型) 是客户文档原意,执行字面要求
  aspectPrefix?: Partial<Record<AspectRatio, string>>;
};

function buildAnalysisSourceKey(input: {
  productInfo: string;
  sourceImages: LocalSourceImage[];
  primaryImageId: string | null;
}) {
  const fileSignature = sourceImagesSignature(input.sourceImages, input.primaryImageId) || 'no-file';
  return `${fileSignature}|${input.productInfo.trim()}`;
}
