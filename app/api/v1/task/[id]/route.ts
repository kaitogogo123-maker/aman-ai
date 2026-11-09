import { NextRequest, NextResponse } from 'next/server';
import { createRuntimeGenerationService } from '@/lib/core/generation/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = await createRuntimeGenerationService().getTask(id, { advance: true });

  if (!task) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  }

  // 归属校验:带 userId 的任务仅本人可看(旧匿名任务无 userId,放行兼容)
  if (task.userId) {
    const uid = await getSessionUid(request);
    if (task.userId !== uid) {
      return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    }
  }

  return NextResponse.json({ task });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  }
  const deleted = await createRuntimeGenerationService().deleteTask(id, uid);

  if (!deleted) {
    return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
