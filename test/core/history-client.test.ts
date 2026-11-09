import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// HeaderAuth(经 SiteHeader)用 useRouter,测试环境无路由上下文,提供桩
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} })
}));

import { HistoryClient } from '@/components/history-client';
import type { GenerationTask } from '@/lib/core/generation/types';

const baseTask: GenerationTask = {
  id: 'task_1',
  deviceId: 'device_1',
  sourceImageUrl: 'https://example.com/source.png',
  status: 'succeeded',
  createdAt: '2026-05-10T00:00:00.000Z',
  updatedAt: '2026-05-10T00:00:00.000Z',
  settings: {
    productInfo: 'Portable air purifier',
    promptProductInfo: 'Portable air purifier',
    model: 'nano-banana-2',
    resolution: '2k',
    aspectRatio: '1:1',
    outputLanguage: 'en',
    fontStyle: 'auto',
    imageTypes: [{ kind: 'selling', count: 1 }],
    totalImages: 1
  },
  items: [
    {
      id: 'item_1',
      kind: 'selling',
      index: 0,
      status: 'succeeded',
      resultUrl: 'https://example.com/result.png'
    }
  ]
};

describe('HistoryClient', () => {
  it('does not flash the empty-state while loading; skeleton is delayed (no synchronous flash)', () => {
    const html = renderToStaticMarkup(
      createElement(HistoryClient, { locale: 'en', initialTasks: [], initialLoading: true })
    );

    // 加载中(fetch 未回、loaded=false):不闪"还没有任务";骨架延迟 250ms 才显示,
    // 首帧(SSR 同步)不出现 → 空历史秒回不再闪 3 个骨架卡
    expect(html).not.toContain('No tasks yet');
    expect(html).not.toContain('history-card-skeleton');
  });

  it('renders initial tasks immediately without waiting for a client fetch', () => {
    const html = renderToStaticMarkup(
      createElement(HistoryClient, { locale: 'en', initialTasks: [baseTask] })
    );

    // 卡片展示标题(取自 productInfo)+ 缩略图 + 查看按钮
    expect(html).toContain('Portable air purifier');
    expect(html).toContain('https://example.com/result.png');
    expect(html).toContain('View');
    expect(html).not.toContain('No tasks yet');
  });

  it('disables view + makes the card non-clickable when the image is unavailable', () => {
    const noImageTask: GenerationTask = {
      ...baseTask,
      id: 'task_noimg',
      items: [{ id: 'item_x', kind: 'selling', index: 0, status: 'succeeded', resultUrl: undefined }]
    };
    const html = renderToStaticMarkup(
      createElement(HistoryClient, { locale: 'en', initialTasks: [noImageTask] })
    );
    // 无图:不渲染图片链接(整模块不可点),且「查看」是 disabled 按钮(非链接)
    expect(html).not.toContain('history-card-imglink');
    expect(html).toContain('disabled');
    expect(html).toContain('history-card-img--empty');
  });
});
