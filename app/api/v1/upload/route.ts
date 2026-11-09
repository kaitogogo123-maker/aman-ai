import { NextRequest, NextResponse } from 'next/server';
import { createRuntimeStorageProvider } from '@/lib/core/storage/runtime';

const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  const deviceId = request.cookies.get('device_id')?.value ?? `device_${crypto.randomUUID()}`;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing image file.' }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, and WEBP images are supported.' }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be 100MB or smaller.' }, { status: 400 });
  }

  const uploaded = await createRuntimeStorageProvider().uploadProductImage({
    fileName: file.name,
    contentType: file.type,
    body: new Uint8Array(await file.arrayBuffer()),
    deviceId
  });

  return NextResponse.json({ upload: uploaded });
}
