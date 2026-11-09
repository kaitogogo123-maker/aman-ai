import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() })
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: unknown; href: string; className?: string }) =>
    createElement('a', { href, className }, children)
}));

vi.mock('@/components/locale-switcher', () => ({
  LocaleSwitcher: ({ locale }: { locale: string }) => createElement('span', { className: 'locale-switcher-test' }, locale)
}));

import { TaskStatusClient } from '@/components/task-status-client';

describe('TaskStatusClient', () => {
  it('uses the requested image count for the initial generation skeletons', () => {
    const html = renderToStaticMarkup(
      createElement(TaskStatusClient, { locale: 'ru', taskId: 'task_1', expectedImages: 3 })
    );

    expect(html).toContain('Создаём 3 изображения');
    expect(html.match(/task-cell/g)).toHaveLength(3);
    // header(含 locale-switcher)已移到共享 layout,不再由本组件渲染
  });
});
