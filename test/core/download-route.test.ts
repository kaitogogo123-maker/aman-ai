import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/v1/download/route';

describe('GET /api/v1/download', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('proxies an allowed result image with attachment headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('image-bytes', {
        status: 200,
        headers: { 'Content-Type': 'image/png' }
      })
    );

    const response = await GET(
      new Request(
        'http://localhost/api/v1/download?url=https%3A%2F%2Fv3.fal.media%2Ffiles%2Fresult.png&name=tamga-result.png'
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="tamga-result.png"');
    expect(fetchSpy).toHaveBeenCalledWith('https://v3.fal.media/files/result.png');
    await expect(response.text()).resolves.toBe('image-bytes');
  });

  it('rejects private network download targets', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/download?url=http%3A%2F%2F127.0.0.1%2Fsecret.png')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid download URL.' });
  });
});
