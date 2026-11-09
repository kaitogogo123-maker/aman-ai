import { NextResponse } from 'next/server';
import { translateRequestSchema } from '@/lib/core/generation/api-schema';
import { createRuntimeTranslator } from '@/lib/core/translation/runtime';

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = translateRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
  }

  try {
    const result = await createRuntimeTranslator().translate({
      text: parsed.data.text,
      targetLang: parsed.data.targetLang
    });

    return NextResponse.json({
      original: parsed.data.text,
      translated: result.translated,
      targetLang: parsed.data.targetLang,
      cacheHit: result.cacheHit,
      provider: result.provider
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed.' },
      { status: 502 }
    );
  }
}
