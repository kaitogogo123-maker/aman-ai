import { NextRequest, NextResponse } from 'next/server';
import { createRuntimeGenerationService } from '@/lib/core/generation/runtime';
import { getSessionUid } from '@/lib/core/auth/cookie';

export async function GET(request: NextRequest) {
  // 历史按登录用户归属(生成已强制登录);未登录返回空
  const uid = await getSessionUid(request);
  if (!uid) {
    return NextResponse.json({ tasks: [] });
  }

  const tasks = await createRuntimeGenerationService().listTasksForUser(uid);
  return NextResponse.json({ tasks });
}
