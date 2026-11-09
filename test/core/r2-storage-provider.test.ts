import { describe, expect, it, vi } from 'vitest';
import { R2StorageProvider } from '@/lib/core/storage/r2-storage-provider';

describe('R2StorageProvider', () => {
  it('uploads an object and returns a public URL when public base URL exists', async () => {
    const send = vi.fn(async () => ({}));
    const presignGetUrl = vi.fn();
    const storage = new R2StorageProvider({
      client: { send },
      bucket: 'tamga-uploads',
      publicBaseUrl: 'https://cdn.example.com/uploads/',
      presignGetUrl
    });

    const uploaded = await storage.uploadProductImage({
      fileName: 'tent photo.png',
      contentType: 'image/png',
      body: new Uint8Array([1, 2, 3]),
      deviceId: 'device_1'
    });

    expect(uploaded.provider).toBe('r2');
    expect(uploaded.key).toMatch(/^uploads\/device_1\/[a-f0-9-]+-tent-photo\.png$/);
    expect(uploaded.url).toBe(`https://cdn.example.com/uploads/${uploaded.key}`);
    expect(send).toHaveBeenCalledOnce();
    expect(presignGetUrl).not.toHaveBeenCalled();
    expect(send.mock.calls[0]?.[0].input).toEqual(
      expect.objectContaining({
        Bucket: 'tamga-uploads',
        Key: uploaded.key,
        Body: new Uint8Array([1, 2, 3]),
        ContentType: 'image/png'
      })
    );
  });

  it('returns a presigned GET URL when no public base URL exists', async () => {
    const send = vi.fn(async () => ({}));
    const presignGetUrl = vi.fn(async () => 'https://signed.example.com/object');
    const storage = new R2StorageProvider({
      client: { send },
      bucket: 'tamga-uploads',
      presignGetUrl
    });

    const uploaded = await storage.uploadProductImage({
      fileName: 'tent.webp',
      contentType: 'image/webp',
      body: new Uint8Array([1]),
      deviceId: 'device_1'
    });

    expect(uploaded.url).toBe('https://signed.example.com/object');
    expect(presignGetUrl).toHaveBeenCalledOnce();
    expect(presignGetUrl.mock.calls[0]?.[1].input).toEqual(
      expect.objectContaining({
        Bucket: 'tamga-uploads',
        Key: uploaded.key
      })
    );
  });
});
