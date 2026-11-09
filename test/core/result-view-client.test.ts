import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: unknown; href: string; className?: string }) =>
    createElement('a', { href, className }, children)
}));

vi.mock('@/components/locale-switcher', () => ({
  LocaleSwitcher: ({ locale }: { locale: string }) => createElement('span', null, locale)
}));

import { ResultViewClient } from '@/components/result-view-client';

describe('ResultViewClient', () => {
  it('renders a friendly loading state with image skeletons before task data arrives', () => {
    const html = renderToStaticMarkup(createElement(ResultViewClient, { locale: 'ru', taskId: 'task_1' }));

    expect(html).toContain('Загрузка результата');
    expect(html).toContain('result-detail--loading');
    expect(html).toContain('result-image-skeleton');
    // 单图(默认 expectedImages=1)不渲染缩略图骨架行
    expect(html.match(/result-thumb-skeleton/g)).toBeNull();
    expect(html).toContain('ru');
    expect(html).not.toContain('bottom-language');
  });

  it('uses the expected image count for first result loading skeletons', () => {
    const html = renderToStaticMarkup(
      createElement(ResultViewClient, { locale: 'ru', taskId: 'task_1', expectedImages: 3 })
    );

    expect(html.match(/result-thumb-skeleton/g)).toHaveLength(3);
  });
});
