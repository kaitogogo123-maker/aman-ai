import { describe, expect, it, vi } from 'vitest';
import { FalGenerationProvider } from '@/lib/core/generation/fal-provider';
import type { GenerationTask } from '@/lib/core/generation/types';

const baseTask: GenerationTask = {
  id: 'task_1',
  deviceId: 'device_1',
  sourceImageUrl: 'https://cdn.example.com/source.png',
  status: 'running',
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
  settings: {
    productInfo: 'Waterproof outdoor tent',
    promptProductInfo: 'Waterproof outdoor tent',
    model: 'nano-banana-2',
    resolution: '2k',
    aspectRatio: '1:1',
    outputLanguage: 'ru',
    fontStyle: 'auto',
    imageTypes: [{ kind: 'selling', count: 1 }],
    totalImages: 1
  },
  items: [
    {
      id: 'item_1',
      kind: 'selling',
      index: 0,
      status: 'running'
    }
  ]
};

describe('FalGenerationProvider', () => {
  it('routes standard quality to Nano Banana 2', () => {
    expect(FalGenerationProvider.modelForQuality('standard')).toBe('fal-ai/nano-banana-2/edit');
  });

  it('routes premium quality to Nano Banana Pro', () => {
    expect(FalGenerationProvider.modelForQuality('premium')).toBe('fal-ai/nano-banana-pro/edit');
  });

  it('uses the task model selection when starting a fal job', async () => {
    const submit = vi.fn(async () => ({
      request_id: 'req_pro'
    }));
    const provider = new FalGenerationProvider({
      client: {
        submit,
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({
          data: {
            images: [{ url: 'https://fal.example.com/result.png' }]
          }
        }))
      }
    });

    await provider.startItem({
      task: {
        ...baseTask,
        settings: {
          ...baseTask.settings,
          model: 'nano-banana-pro'
        }
      },
      item: baseTask.items[0]
    });

    expect(submit).toHaveBeenCalledWith(
      'fal-ai/nano-banana-pro/edit',
      expect.any(Object)
    );
  });

  it('subscribes to fal.ai with image_urls, resolution, aspect ratio, and prompt', async () => {
    const submit = vi.fn(async () => ({
      request_id: 'req_1'
    }));
    const provider = new FalGenerationProvider({
      client: {
        submit,
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({
          data: {
            images: [{ url: 'https://fal.example.com/result.png' }]
          }
        }))
      }
    });

    const started = await provider.startItem({
      task: baseTask,
      item: baseTask.items[0]
    });

    expect(started).toEqual({ status: 'running', requestId: 'req_1' });
    expect(submit).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledWith(
      'fal-ai/nano-banana-2/edit',
      expect.objectContaining({
        input: expect.objectContaining({
          image_urls: ['https://cdn.example.com/source.png'],
          num_images: 1,
          aspect_ratio: '1:1',
          resolution: '2K',
          output_format: 'png'
        })
      })
    );
    const call = submit.mock.calls[0];
    expect(call?.[1].input.prompt).toContain('Waterproof outdoor tent');
    expect(call?.[1].input.prompt).toContain('hero shot');
    expect(call?.[1].input.prompt).toContain('Russian');
    expect(call?.[1].input.prompt).toContain('Let the model choose a clean, legible ecommerce type style.');
  });

  it('turns selected font styles into explicit prompt guidance', async () => {
    const submit = vi.fn(async () => ({
      request_id: 'req_1'
    }));
    const provider = new FalGenerationProvider({
      client: {
        submit,
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({
          data: {
            images: [{ url: 'https://fal.example.com/result.png' }]
          }
        }))
      }
    });

    await provider.startItem({
      task: {
        ...baseTask,
        settings: {
          ...baseTask.settings,
          outputLanguage: 'zh',
          fontStyle: 'geometric_sans'
        }
      },
      item: baseTask.items[0]
    });

    const call = submit.mock.calls[0];
    expect(call?.[1].input.prompt).toContain('Chinese');
    expect(call?.[1].input.prompt).toContain('modern geometric sans-serif');
    expect(call?.[1].input.prompt).not.toContain('geometric_sans');
  });

  it('passes the primary image first and reference images after it to fal.ai', async () => {
    const submit = vi.fn(async () => ({
      request_id: 'req_1'
    }));
    const provider = new FalGenerationProvider({
      client: {
        submit,
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({
          data: {
            images: [{ url: 'https://fal.example.com/result.png' }]
          }
        }))
      }
    });

    await provider.startItem({
      task: {
        ...baseTask,
        sourceImageUrls: [
          'https://cdn.example.com/primary.png',
          'https://cdn.example.com/reference-1.png',
          'https://cdn.example.com/reference-2.png'
        ]
      },
      item: baseTask.items[0]
    });

    expect(submit).toHaveBeenCalledWith(
      'fal-ai/nano-banana-2/edit',
      expect.objectContaining({
        input: expect.objectContaining({
          image_urls: [
            'https://cdn.example.com/primary.png',
            'https://cdn.example.com/reference-1.png',
            'https://cdn.example.com/reference-2.png'
          ]
        })
      })
    );
  });

  it('uses translated english prompt text when available', async () => {
    const submit = vi.fn(async () => ({
      request_id: 'req_1'
    }));
    const provider = new FalGenerationProvider({
      client: {
        submit,
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({
          data: {
            images: [{ url: 'https://fal.example.com/result.png' }]
          }
        }))
      }
    });

    await provider.startItem({
      task: {
        ...baseTask,
        settings: {
          ...baseTask.settings,
          productInfo: '卧室桌面空气净化器，低噪音，HEPA过滤。',
          promptProductInfo: 'Portable air purifier for bedrooms and desks.'
        }
      },
      item: baseTask.items[0]
    });

    const call = submit.mock.calls[0];
    expect(call?.[1].input.prompt).toContain('Portable air purifier for bedrooms and desks.');
    expect(call?.[1].input.prompt).not.toContain('卧室桌面空气净化器');
  });

  it('uses apparel model-image prompt framing in model mode', async () => {
    const submit = vi.fn(async () => ({
      request_id: 'req_model'
    }));
    const provider = new FalGenerationProvider({
      client: {
        submit,
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({
          data: {
            images: [{ url: 'https://fal.example.com/result.png' }]
          }
        }))
      }
    });

    await provider.startItem({
      task: {
        ...baseTask,
        settings: {
          ...baseTask.settings,
          mode: 'model',
          productInfo: '男士户外机能工装裤'
        }
      },
      item: baseTask.items[0]
    });

    const call = submit.mock.calls[0];
    expect(call?.[1].input.prompt).toContain('fashion model ecommerce image');
    expect(call?.[1].input.prompt).toContain('fit, fabric, styling, model pose');
  });

  it('returns a readable failure when fal.ai completes without an image URL', async () => {
    const provider = new FalGenerationProvider({
      client: {
        submit: vi.fn(async () => ({ request_id: 'req_1' })),
        status: vi.fn(async () => ({ status: 'COMPLETED' })),
        result: vi.fn(async () => ({ data: { images: [] } }))
      }
    });

    await expect(
      provider.syncItem({
        task: baseTask,
        item: {
          ...baseTask.items[0],
          providerRequestId: 'req_1'
        }
      })
    ).resolves.toEqual({
      status: 'failed',
      error: 'fal.ai response did not include an image URL.'
    });
  });

  it('keeps a running item in progress until fal.ai completes', async () => {
    const provider = new FalGenerationProvider({
      client: {
        submit: vi.fn(async () => ({ request_id: 'req_1' })),
        status: vi.fn(async () => ({ status: 'IN_PROGRESS' })),
        result: vi.fn()
      }
    });

    await expect(
      provider.syncItem({
        task: baseTask,
        item: {
          ...baseTask.items[0],
          providerRequestId: 'req_1'
        }
      })
    ).resolves.toEqual({
      status: 'running',
      requestId: 'req_1'
    });
  });
});
