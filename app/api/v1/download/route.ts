import { NextResponse } from 'next/server';

const ALLOWED_RESULT_HOSTS = [
  'fal.media',
  'r2.dev',
  'r2.cloudflarestorage.com',
  'cloudflarestorage.com'
];

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get('url');
  const rawName = requestUrl.searchParams.get('name') ?? 'tamga-result.png';

  if (!rawUrl) {
    return NextResponse.json({ error: 'Invalid download URL.' }, { status: 400 });
  }

  const targetUrl = parseDownloadUrl(rawUrl, requestUrl);
  if (!targetUrl || !isAllowedDownloadTarget(targetUrl, requestUrl)) {
    return NextResponse.json({ error: 'Invalid download URL.' }, { status: 400 });
  }

  const upstream = await fetch(targetUrl.toString());
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Download is temporarily unavailable.' }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${sanitizeDownloadName(rawName)}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}

function parseDownloadUrl(rawUrl: string, requestUrl: URL) {
  try {
    return new URL(rawUrl, requestUrl.origin);
  } catch {
    return null;
  }
}

function isAllowedDownloadTarget(targetUrl: URL, requestUrl: URL) {
  if (!['https:', 'http:'].includes(targetUrl.protocol)) {
    return false;
  }

  if (targetUrl.origin === requestUrl.origin) {
    return true;
  }

  if (targetUrl.protocol !== 'https:') {
    return false;
  }

  const host = targetUrl.hostname.toLowerCase();
  return ALLOWED_RESULT_HOSTS.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
}

function sanitizeDownloadName(rawName: string) {
  const sanitized = rawName.replace(/[/\\?%*:|"<>]/g, '-').trim();
  return sanitized || 'tamga-result.png';
}
