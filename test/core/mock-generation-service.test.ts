import { describe, expect, it, vi } from 'vitest';
import { composeProductInfo } from '@/lib/core/analysis/compose-product-info';
import { createGenerationService } from '@/lib/core/generation/service';
import { createMemoryTaskStore } from '@/lib/core/generation/task-store';
import { MockGenerationProvider } from '@/lib/core/generation/mock-provider';
import type { GenerationProvider } from '@/lib/core/generation/types';

describe('createGenerationService', () => {
  it('creates a queued task with one item per requested image', async () => {
    const service = createGenerationService({
      taskStore: createMemoryTaskStore(),
      provider: new MockGenerationProvider()
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: 'Waterproof outdoor tent',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [
          { kind: 'selling', count: 2 },
          { kind: 'scene', count: 1 }
        ]
      }
    });

    expect(task.status).toBe('queued');
    expect(task.items).toHaveLength(3);
    expect(task.items.map((item) => item.status)).toEqual(['queued', 'queued', 'queued']);
  });

  it('translates non-english product info into english prompt text once per task', async () => {
    const translate = vi.fn(async () => ({
      translated: 'Portable air purifier for bedrooms and desks.',
      provider: 'qwen-mt' as const,
      cacheHit: false
    }));
    const service = createGenerationService({
      taskStore: createMemoryTaskStore(),
      provider: new MockGenerationProvider(),
      translator: {
        translate
      }
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: '卧室桌面空气净化器，低噪音，HEPA过滤。',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }
    });

    expect(task.settings.productInfo).toBe('卧室桌面空气净化器，低噪音，HEPA过滤。');
    expect(task.settings.promptProductInfo).toBe('Portable air purifier for bedrooms and desks.');
    expect(translate).toHaveBeenCalledOnce();
    expect(translate).toHaveBeenCalledWith({
      text: '卧室桌面空气净化器，低噪音，HEPA过滤。',
      targetLang: 'en'
    });
  });

  it('keeps english product info without calling the translator', async () => {
    const translate = vi.fn();
    const service = createGenerationService({
      taskStore: createMemoryTaskStore(),
      provider: new MockGenerationProvider(),
      translator: {
        translate
      }
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: 'Portable air purifier for bedrooms and desks.',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }
    });

    expect(task.settings.promptProductInfo).toBe('Portable air purifier for bedrooms and desks.');
    expect(translate).not.toHaveBeenCalled();
  });

  it('prefers structured analysis for prompt translation while preserving raw product info', async () => {
    const translate = vi.fn(async () => ({
      translated: 'Structured prompt in English.',
      provider: 'qwen-mt' as const,
      cacheHit: false
    }));
    const service = createGenerationService({
      taskStore: createMemoryTaskStore(),
      provider: new MockGenerationProvider(),
      translator: {
        translate
      }
    });
    const analysis = {
      productName: '空气净化器',
      targetAudience: '卧室和桌面用户',
      sellingPoints: '低噪音，HEPA 过滤',
      materialDescription: '白色 ABS 机身',
      usageInstructions: '轻触按钮即可启动',
      category: 'Home Appliances > Air Purifiers'
    };

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: '用户自己填写的原始商品描述',
        analysis,
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }
    });

    expect(task.settings.productInfo).toBe('用户自己填写的原始商品描述');
    expect(task.settings.analysis).toEqual(analysis);
    expect(task.settings.promptProductInfo).toBe('Structured prompt in English.');
    expect(translate).toHaveBeenCalledOnce();
    expect(translate).toHaveBeenCalledWith({
      text: `${composeProductInfo(analysis)}\n\nOriginal seller input:\n用户自己填写的原始商品描述`,
      targetLang: 'en'
    });
  });

  it('uses a visible-image fallback prompt when product info and analysis are blank', async () => {
    const service = createGenerationService({
      taskStore: createMemoryTaskStore(),
      provider: new MockGenerationProvider()
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: '/mock-results/source-product.svg',
      settings: {
        productInfo: '   ',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'zh',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'white', count: 1 }]
      }
    });

    expect(task.settings.productInfo).toBe('');
    expect(task.settings.promptProductInfo).toBe('Use the visible product in the uploaded source image as the product reference.');
  });

  it('runs a mock task to success and records result URLs', async () => {
    const store = createMemoryTaskStore();
    const service = createGenerationService({
      taskStore: store,
      provider: new MockGenerationProvider()
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: 'Waterproof outdoor tent',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 2 }]
      }
    });

    const completed = await service.runTask(task.id);

    expect(completed.status).toBe('succeeded');
    expect(completed.items).toHaveLength(2);
    expect(completed.items.every((item) => item.resultUrl?.startsWith('/mock-results/'))).toBe(true);
  });

  it('advances a queued real-mode style task one step at a time', async () => {
    const store = createMemoryTaskStore();
    const provider: GenerationProvider = {
      async startItem() {
        return { status: 'running', requestId: 'req_1' };
      },
      async syncItem() {
        return { status: 'succeeded', resultUrl: 'https://fal.example.com/result.png' };
      },
      async generateItem() {
        return { resultUrl: 'https://fal.example.com/result.png' };
      }
    };
    const service = createGenerationService({
      taskStore: store,
      provider
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: 'Waterproof outdoor tent',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [{ kind: 'selling', count: 1 }]
      }
    });

    const running = await service.advanceTask(task.id);
    expect(running.status).toBe('running');
    expect(running.items[0]?.status).toBe('running');
    expect(running.items[0]?.providerRequestId).toBe('req_1');

    const completed = await service.advanceTask(task.id);
    expect(completed.status).toBe('succeeded');
    expect(completed.items[0]?.resultUrl).toBe('https://fal.example.com/result.png');
  });

  it('starts up to eight images in parallel on the first advance', async () => {
    const store = createMemoryTaskStore();
    const startedKinds: string[] = [];
    const provider: GenerationProvider = {
      async startItem({ item }) {
        startedKinds.push(item.id);
        return { status: 'running', requestId: `req_${item.id}` };
      },
      async syncItem({ item }) {
        return { status: 'succeeded', resultUrl: `https://fal.example.com/${item.id}.png` };
      },
      async generateItem() {
        return { resultUrl: 'https://fal.example.com/result.png' };
      }
    };
    const service = createGenerationService({
      taskStore: store,
      provider
    });

    const task = await service.createTask({
      deviceId: 'device_1',
      sourceImageUrl: 'https://example.com/input.png',
      settings: {
        productInfo: 'Waterproof outdoor tent',
        model: 'nano-banana-2',
        resolution: '2k',
        aspectRatio: '1:1',
        outputLanguage: 'ru',
        fontStyle: 'auto',
        imageTypes: [
          { kind: 'selling', count: 8 },
          { kind: 'closeup', count: 2 }
        ]
      }
    });

    const running = await service.advanceTask(task.id);

    expect(startedKinds).toHaveLength(8);
    expect(running.status).toBe('running');
    expect(running.items.filter((item) => item.status === 'running')).toHaveLength(8);
    expect(running.items.filter((item) => item.status === 'queued')).toHaveLength(2);
  });

  it('returns null (not throw) for a nonexistent task even with advance', async () => {
    const service = createGenerationService({
      taskStore: createMemoryTaskStore(),
      provider: new MockGenerationProvider()
    });

    await expect(service.getTask('task_does_not_exist', { advance: true })).resolves.toBeNull();
  });
});
