import { getCloudflareContext } from '@opennextjs/cloudflare';

type Fetcher = typeof fetch;

interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectBody | null>;
}

interface CloudflareEnvWithR2 {
  R2_UPLOADS?: R2BucketLike;
  R2_RESULTS?: R2BucketLike;
}

const R2_HOST_TO_BINDING: Array<{ match: (host: string) => boolean; binding: 'R2_UPLOADS' | 'R2_RESULTS' }> = [
  // S3-compatible endpoint: <bucket>.<account>.r2.cloudflarestorage.com
  { match: (host) => host.startsWith('tamga-uploads.') && host.endsWith('.r2.cloudflarestorage.com'), binding: 'R2_UPLOADS' },
  { match: (host) => host.startsWith('tamga-results.') && host.endsWith('.r2.cloudflarestorage.com'), binding: 'R2_RESULTS' },
  // Public R2.dev subdomain points to the bucket where it was enabled (tamga-uploads in our case).
  // If results bucket also gets a separate pub-* domain in the future, add it here explicitly.
  { match: (host) => host === 'pub-88557b2819544c58b08b07b52d335258.r2.dev', binding: 'R2_UPLOADS' }
];

export function createR2AwareFetcher(): Fetcher {
  const fallback: Fetcher = (input, init) => fetch(input as RequestInfo, init);

  return async (input, init) => {
    const urlText =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    const resolution = resolveR2Bucket(urlText);
    if (resolution.bucket === null) {
      if (resolution.reason !== 'host-not-r2') {
        console.warn('R2 binding fetcher fell back to HTTP fetch', {
          host: safeHost(urlText),
          reason: resolution.reason
        });
      }
      return fallback(input, init);
    }

    const key = extractR2Key(urlText);
    if (!key) {
      console.warn('R2 binding fetcher could not extract key, falling back', { host: safeHost(urlText) });
      return fallback(input, init);
    }

    const obj = await resolution.bucket.get(key);
    if (!obj) {
      console.warn('R2 binding fetcher: object not found', { binding: resolution.bindingName, key });
      return new Response('R2 object not found', { status: 404 });
    }

    const buffer = await obj.arrayBuffer();
    const contentType = obj.httpMetadata?.contentType || guessContentType(key);

    return new Response(buffer, {
      status: 200,
      headers: { 'Content-Type': contentType }
    });
  };
}

interface R2Resolution {
  bucket: R2BucketLike | null;
  bindingName: 'R2_UPLOADS' | 'R2_RESULTS' | null;
  reason: 'ok' | 'host-not-r2' | 'invalid-url' | 'no-cloudflare-context' | 'binding-missing';
}

function safeHost(urlText: string): string {
  try {
    return new URL(urlText).hostname;
  } catch {
    return '<invalid-url>';
  }
}

function resolveR2Bucket(urlText: string): R2Resolution {
  let parsed: URL;
  try {
    parsed = new URL(urlText);
  } catch {
    return { bucket: null, bindingName: null, reason: 'invalid-url' };
  }

  const binding = R2_HOST_TO_BINDING.find((entry) => entry.match(parsed.hostname));
  if (!binding) {
    return { bucket: null, bindingName: null, reason: 'host-not-r2' };
  }

  let env: CloudflareEnvWithR2;
  try {
    env = getCloudflareContext().env as CloudflareEnvWithR2;
  } catch {
    return { bucket: null, bindingName: binding.binding, reason: 'no-cloudflare-context' };
  }

  const bucket = env[binding.binding];
  if (!bucket) {
    return { bucket: null, bindingName: binding.binding, reason: 'binding-missing' };
  }

  return { bucket, bindingName: binding.binding, reason: 'ok' };
}

function extractR2Key(urlText: string): string | null {
  try {
    const parsed = new URL(urlText);
    const pathname = parsed.pathname.replace(/^\//, '');
    return pathname ? decodeURIComponent(pathname) : null;
  } catch {
    return null;
  }
}

function guessContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}
