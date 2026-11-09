import { NextResponse } from 'next/server';
import { createRuntimeProductAnalyzer } from '@/lib/core/analysis/runtime';
import { analyzeProductRequestSchema } from '@/lib/core/generation/api-schema';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = analyzeProductRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Invalid request.'
      },
      { status: 400 }
    );
  }

  if (!parsed.data.sourceImageUrl && !parsed.data.productInfoRaw.trim()) {
    return NextResponse.json(
      { error: 'Provide a product image or raw product information first.' },
      { status: 400 }
    );
  }

  try {
    const analysis = await createRuntimeProductAnalyzer().analyze(parsed.data);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Product analysis failed', {
      locale: parsed.data.locale,
      mode: parsed.data.mode,
      hasImage: Boolean(parsed.data.sourceImageUrl || parsed.data.sourceImageUrls?.length),
      rawLength: parsed.data.productInfoRaw.length,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      { error: formatAnalysisError(error, parsed.data.locale) },
      { status: 502 }
    );
  }
}

function formatAnalysisError(error: unknown, locale: 'ru' | 'kk' | 'en' | 'zh') {
  const message = error instanceof Error ? error.message : 'Product analysis failed.';
  const accessDeniedMatch = message.match(/access to ([^.]+)\./);

  if (accessDeniedMatch) {
    return localizedError(locale, 'accessDenied');
  }

  if (/could not read uploaded product image|too large for ai analysis|image format is not supported/i.test(message)) {
    return localizedError(locale, 'imageUnavailable');
  }

  if (/image analysis did not include enough visual product details/i.test(message)) {
    return localizedError(locale, 'weakVisualAnalysis');
  }

  if (isInternalAnalysisError(message)) {
    return localizedError(locale, 'invalidStructure');
  }

  return localizedError(locale, 'temporaryFailure');
}

function isInternalAnalysisError(message: string) {
  return /qwen|dashscope|json|model\.|chatcmpl|request_id|analysis response|product analysis request/i.test(message);
}

function localizedError(
  locale: 'ru' | 'kk' | 'en' | 'zh',
  kind: 'accessDenied' | 'invalidStructure' | 'weakVisualAnalysis' | 'imageUnavailable' | 'temporaryFailure'
) {
  switch (locale) {
    case 'zh':
      if (kind === 'accessDenied') {
        return 'AI 分析暂时不可用：当前账号还没有开通图片理解能力。请联系管理员检查 AI 模型权限。';
      }
      if (kind === 'invalidStructure') {
        return 'AI 暂时没能整理出结构化商品信息。请补充更完整的商品名称、核心卖点或使用场景后再试。';
      }
      if (kind === 'weakVisualAnalysis') {
        return 'AI 暂时没有从图片中识别出足够商品细节。请换一张更清晰的主图，或补充商品卖点后再试。';
      }
      if (kind === 'imageUnavailable') {
        return 'AI 暂时读取不到这张图片。请重新上传一张清晰的 JPG、PNG 或 WebP 主图后再试。';
      }
      return 'AI 分析暂时不可用，请稍后再试。';
    case 'ru':
      if (kind === 'accessDenied') {
        return 'AI-анализ временно недоступен: для аккаунта не включено понимание изображений. Обратитесь к администратору, чтобы проверить права AI-модели.';
      }
      if (kind === 'invalidStructure') {
        return 'AI пока не смог аккуратно оформить информацию о товаре. Добавьте название товара, ключевые преимущества или сценарий использования и попробуйте ещё раз.';
      }
      if (kind === 'weakVisualAnalysis') {
        return 'AI пока не распознал достаточно деталей на изображении. Загрузите более чёткое главное фото или добавьте ключевые преимущества товара.';
      }
      if (kind === 'imageUnavailable') {
        return 'AI пока не может прочитать это изображение. Загрузите чёткое главное фото в формате JPG, PNG или WebP и попробуйте снова.';
      }
      return 'AI-анализ временно недоступен. Попробуйте ещё раз чуть позже.';
    case 'kk':
      if (kind === 'accessDenied') {
        return 'AI талдау уақытша қолжетімсіз: бұл аккаунтта суретті түсіну мүмкіндігі қосылмаған. AI моделінің рұқсаттарын тексеру үшін әкімшіге хабарласыңыз.';
      }
      if (kind === 'invalidStructure') {
        return 'AI тауар ақпаратын құрылымдап бере алмады. Тауар атауын, негізгі артықшылықтарын немесе қолдану жағдайын толықтырып, қайта байқап көріңіз.';
      }
      if (kind === 'weakVisualAnalysis') {
        return 'AI суреттен жеткілікті тауар детальдарын анықтай алмады. Негізгі суретті анығырақ жүктеңіз немесе тауар артықшылықтарын толықтырыңыз.';
      }
      if (kind === 'imageUnavailable') {
        return 'AI бұл суретті оқи алмады. JPG, PNG немесе WebP форматындағы анық негізгі суретті қайта жүктеп көріңіз.';
      }
      return 'AI талдау уақытша қолжетімсіз. Сәл кейінірек қайталап көріңіз.';
    case 'en':
    default:
      if (kind === 'accessDenied') {
        return 'AI analysis is temporarily unavailable because image understanding is not enabled for this account. Ask an administrator to check the AI model permissions.';
      }
      if (kind === 'invalidStructure') {
        return 'AI could not turn this into structured product information yet. Add a clearer product name, key selling points, or usage scenario and try again.';
      }
      if (kind === 'weakVisualAnalysis') {
        return 'AI could not identify enough product details from the image. Try a clearer main image, or add key selling points before analyzing again.';
      }
      if (kind === 'imageUnavailable') {
        return 'AI could not read this image yet. Upload a clear JPG, PNG, or WebP main image and try again.';
      }
      return 'AI analysis is temporarily unavailable. Please try again later.';
  }
}
