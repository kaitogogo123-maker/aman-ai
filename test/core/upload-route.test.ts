import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadProductImage } = vi.hoisted(() => ({
  uploadProductImage: vi.fn()
}));

vi.mock('@/lib/core/storage/runtime', () => ({
  createRuntimeStorageProvider: () => ({
    uploadProductImage
  })
}));

import { POST } from '@/app/api/v1/upload/route';

describe('POST /api/v1/upload', () => {
  beforeEach(() => {
    uploadProductImage.mockReset();
    uploadProductImage.mockResolvedValue({
      key: 'uploads/device_1/product.png',
      url: 'https://cdn.example.com/uploads/device_1/product.png',
      provider: 'r2'
    });
  });

  it('accepts image files up to 100MB', async () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array(100 * 1024 * 1024)], 'large-product.png', { type: 'image/png' }));

    const response = await POST(
      new NextRequest('http://localhost/api/v1/upload', {
        method: 'POST',
        body: formData
      })
    );

    expect(response.status).toBe(200);
    expect(uploadProductImage).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'large-product.png',
        contentType: 'image/png',
        body: expect.any(Uint8Array)
      })
    );
  }, 20000);

  it('rejects image files larger than 100MB', async () => {
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array(100 * 1024 * 1024 + 1)], 'too-large.png', { type: 'image/png' }));

    const response = await POST(
      new NextRequest('http://localhost/api/v1/upload', {
        method: 'POST',
        body: formData
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Image must be 100MB or smaller.' });
    expect(uploadProductImage).not.toHaveBeenCalled();
  }, 20000);
});
