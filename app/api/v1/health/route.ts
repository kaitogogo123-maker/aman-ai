import { NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/config/env';
import { resolveRuntimeReadiness } from '@/lib/config/runtime-readiness';

export function GET() {
  const readiness = resolveRuntimeReadiness(getRuntimeEnv());

  return NextResponse.json(
    {
      app: 'tamga',
      ...readiness
    },
    {
      status: readiness.ok ? 200 : 503
    }
  );
}
