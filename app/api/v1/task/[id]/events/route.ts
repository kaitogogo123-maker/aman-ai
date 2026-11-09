import type { NextRequest } from 'next/server';
import { createRuntimeGenerationService } from '@/lib/core/generation/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const fetched = await createRuntimeGenerationService().getTask(id, { advance: true });
  // 归属校验:带 userId 的任务仅本人可拉状态(含结果图);非本人按不存在处理
  const task = fetched && fetched.userId && fetched.userId !== (await getSessionUid(request)) ? null : fetched;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            status: task?.status ?? 'failed',
            task
          })}\n\n`
        )
      );
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  });
}
