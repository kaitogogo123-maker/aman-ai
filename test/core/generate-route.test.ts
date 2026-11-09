import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTask = vi.fn();
const advanceTask = vi.fn();

vi.mock('@/lib/core/generation/runtime', () => ({
  createRuntimeGenerationService: () => ({
    createTask,
    advanceTask
  })
}));

// 生成现在要求登录 + 扣费:mock 登录态与钱包(余额充足)
vi.mock('@/lib/core/auth/cookie', () => ({
  getSessionUid: async () => 'usr_test'
}));

vi.mock('@/lib/core/auth/runtime', () => ({
  createRuntimeAuthService: () => ({
    me: async () => ({ phone: '70000000000', balance: 1000 }),
    deduct: async () => ({ ok: true, balance: 1000 }),
    getWallet: async () => ({ balance: 1000 }),
    refund: async () => undefined,
    topup: async () => ({ balance: 1000 })
  })
}));

import { POST } from '@/app/api/v1/generate/route';

describe('POST /api/v1/generate', () => {
  beforeEach(() => {
    createTask.mockReset();
    advanceTask.mockReset();
  });

  it('forwards structured analysis to the generation service', async () => {
    createTask.mockResolvedValue({
      id: 'task_1'
    });
    advanceTask.mockResolvedValue({
      id: 'task_1',
      status: 'running'
    });

    const request = new Request('http://localhost/api/v1/generate', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/input.png',
        productInfo: '用户原始描述',
        analysis: {
          productName: '空气净化器',
          targetAudience: '卧室和桌面用户',
          sellingPoints: '低噪音，HEPA 过滤',
          materialDescription: '白色 ABS 机身',
          usageInstructions: '轻触按钮即可启动',
          category: 'Home Appliances > Air Purifiers'
        },
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '16:9',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'device_id=device_from_cookie'
      }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(createTask).toHaveBeenCalledWith({
      deviceId: 'device_from_cookie',
      userId: 'usr_test',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        mode: 'product',
        platform: 'general',
        productInfo: '用户原始描述',
        analysis: {
          productName: '空气净化器',
          targetAudience: '卧室和桌面用户',
          sellingPoints: '低噪音，HEPA 过滤',
          materialDescription: '白色 ABS 机身',
          usageInstructions: '轻触按钮即可启动',
          category: 'Home Appliances > Air Purifiers'
        },
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '16:9',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }
    });
    expect(advanceTask).toHaveBeenCalledWith('task_1');
    await expect(response.json()).resolves.toEqual({
      task: {
        id: 'task_1',
        status: 'running'
      },
      balance: 1000
    });
  });

  it('accepts a request with structured analysis even when raw product info is blank', async () => {
    createTask.mockResolvedValue({
      id: 'task_2'
    });
    advanceTask.mockResolvedValue({
      id: 'task_2',
      status: 'running'
    });

    const request = new Request('http://localhost/api/v1/generate', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/input.png',
        productInfo: '   ',
        analysis: {
          productName: '空气净化器',
          targetAudience: '卧室和桌面用户',
          sellingPoints: '低噪音，HEPA 过滤',
          materialDescription: '白色 ABS 机身',
          usageInstructions: '轻触按钮即可启动',
          category: 'Home Appliances > Air Purifiers'
        },
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '16:9',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(createTask).toHaveBeenCalledWith({
      deviceId: expect.stringMatching(/^device_/),
      userId: 'usr_test',
      sourceImageUrl: 'https://example.com/input.png',
      settings: expect.objectContaining({
        productInfo: '',
        analysis: {
          productName: '空气净化器',
          targetAudience: '卧室和桌面用户',
          sellingPoints: '低噪音，HEPA 过滤',
          materialDescription: '白色 ABS 机身',
          usageInstructions: '轻触按钮即可启动',
          category: 'Home Appliances > Air Purifiers'
        }
      })
    });
  });

  it('accepts image-only generation when product info and analysis are blank', async () => {
    createTask.mockResolvedValue({
      id: 'task_image_only'
    });
    advanceTask.mockResolvedValue({
      id: 'task_image_only',
      status: 'running'
    });

    const request = new Request('http://localhost/api/v1/generate', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrl: 'https://example.com/input.png',
        sourceImageUrls: ['https://example.com/input.png'],
        mode: 'product',
        productInfo: '',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '9:16',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'white', count: 1 }]
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(createTask).toHaveBeenCalledWith({
      deviceId: expect.stringMatching(/^device_/),
      userId: 'usr_test',
      sourceImageUrl: 'https://example.com/input.png',
      sourceImageUrls: ['https://example.com/input.png'],
      settings: expect.objectContaining({
        productInfo: '',
        analysis: undefined,
        imageTypes: [{ kind: 'white', count: 1 }]
      })
    });
  });

  it('forwards ordered source image urls while keeping the first image as primary', async () => {
    createTask.mockResolvedValue({
      id: 'task_3'
    });
    advanceTask.mockResolvedValue({
      id: 'task_3',
      status: 'running'
    });

    const request = new Request('http://localhost/api/v1/generate', {
      method: 'POST',
      body: JSON.stringify({
        sourceImageUrls: [
          'https://example.com/primary.png',
          'https://example.com/reference.png'
        ],
        productInfo: '用户原始描述',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '16:9',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(createTask).toHaveBeenCalledWith({
      deviceId: expect.stringMatching(/^device_/),
      userId: 'usr_test',
      sourceImageUrl: 'https://example.com/primary.png',
      sourceImageUrls: [
        'https://example.com/primary.png',
        'https://example.com/reference.png'
      ],
      settings: expect.objectContaining({
        productInfo: '用户原始描述'
      })
    });
  });
});
