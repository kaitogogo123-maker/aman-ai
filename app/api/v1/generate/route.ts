import { NextRequest, NextResponse } from 'next/server';
import { generateRequestSchema } from '@/lib/core/generation/api-schema';
import { createRuntimeGenerationService } from '@/lib/core/generation/runtime';
import { createRuntimeAuthService } from '@/lib/core/auth/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';
import { isPaymentWhitelisted } from '@/lib/core/payment/free-access';
import { getMessages } from '@/lib/i18n';

export async function POST(request: NextRequest) {
  // 生成必须登录(免费浏览,生成扣费)
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const deviceId = getDeviceId(request);
  const json = await request.json().catch(() => null);
  const parsed = generateRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
  }

  // 额度制(套餐购买):余额=图额度(张数),生图扣 1 张额度/张。量大优惠在购买时已兑现,
  // 与生图扣费无关(不再按 ₸ 单价扣)。
  const auth = createRuntimeAuthService();
  const totalImages = parsed.data.imageTypes.reduce((sum, item) => sum + item.count, 0);
  const cost = totalImages;

  // 免支付白名单(测试/演示账号):跳过扣费,生图不消耗额度。
  const profile = await auth.me(uid);
  const freeAccess = isPaymentWhitelisted(profile?.phone);

  const charge = freeAccess ? { ok: true as const, balance: profile?.balance } : await auth.deduct(uid, cost, 'generation');
  if (!charge.ok) {
    const wallet = await auth.getWallet(uid);
    return NextResponse.json(
      { error: 'INSUFFICIENT_BALANCE', cost, balance: wallet?.balance ?? 0 },
      { status: 402 }
    );
  }

  try {
    const generationService = createRuntimeGenerationService();
    const task = await generationService.createTask({
      deviceId,
      userId: uid,
      sourceImageUrl: parsed.data.sourceImageUrl,
      sourceImageUrls: parsed.data.sourceImageUrls,
      settings: {
        mode: parsed.data.mode,
        platform: parsed.data.platform,
        category: parsed.data.category,
        productInfo: parsed.data.productInfo,
        analysis: parsed.data.analysis,
        model: parsed.data.model,
        resolution: parsed.data.resolution,
        aspectRatio: parsed.data.aspectRatio,
        outputLanguage: parsed.data.outputLanguage,
        fontStyle: parsed.data.fontStyle,
        imageTypes: parsed.data.imageTypes
      }
    });
    const nextTask = await generationService.advanceTask(task.id);

    return NextResponse.json({ task: nextTask, balance: charge.balance });
  } catch (error) {
    // 生成失败:退还本次扣费(用户没拿到结果不应被扣钱);白名单未扣费则无需退。
    if (!freeAccess) await auth.refund(uid, cost);

    // 图像模型(fal.ai / nano-banana)对人物/角色等内容会返回 403，给用户本地化的友好提示而不是裸露的 "Forbidden"
    if (isForbiddenError(error)) {
      const messages = getMessages(request.headers.get('x-locale') ?? request.cookies.get('locale')?.value ?? 'ru');
      return NextResponse.json({ error: messages.generationContentRejected }, { status: 422 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed.' },
      { status: 400 }
    );
  }
}

function isForbiddenError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status: unknown }).status === 403;
}

function getDeviceId(request: Request) {
  const nextRequest = request as NextRequest;
  const cookieValue = nextRequest.cookies?.get?.('device_id')?.value;
  if (cookieValue) {
    return cookieValue;
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  const pair = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('device_id='));

  return pair?.slice('device_id='.length) || `device_${crypto.randomUUID()}`;
}
