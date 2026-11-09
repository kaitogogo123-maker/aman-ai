'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { GenerationTask } from '@/lib/core/generation/types';
import { getMessages, resolveLocale } from '@/lib/i18n';

export function TaskStatusClient({
  locale,
  taskId,
  expectedImages = 1
}: {
  locale: string;
  taskId: string;
  expectedImages?: number;
}) {
  const router = useRouter();
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedImageCount = normalizeExpectedImages(expectedImages);

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;
    // 动态退避:首拍 900ms(尽早推进生成+捕获完成),逐步拉到 2.5s 上限降负载
    let delay = 900;

    async function loadTask() {
      const response = await fetch(`/api/v1/task/${taskId}`);
      if (!response.ok) {
        if (active) {
          setError(messages.taskNotFound);
        }
        return;
      }

      const data = (await response.json()) as { task: GenerationTask };
      if (!active) return;
      setTask(data.task);

      if (data.task.status === 'succeeded') {
        timeoutId = window.setTimeout(
          () => router.replace(`/${currentLocale}/result/${taskId}?count=${data.task.items.length}`),
          600
        );
        return;
      }

      if (data.task.status === 'failed' || data.task.status === 'canceled') {
        setError(data.task.items.find((item) => item.error)?.error ?? messages.generationFailed);
        return;
      }

      timeoutId = window.setTimeout(loadTask, delay);
      delay = Math.min(delay + 300, 2500);
    }

    loadTask();
    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [currentLocale, messages.generationFailed, messages.taskNotFound, router, taskId]);

  const visibleCount = task?.items.length ?? requestedImageCount;
  const placeholderItems = Array.from({ length: visibleCount }, (_, index) => `mock_${index}`);

  return (
    <>
        {error ? (
          // 失败/未找到:清爽失败态,不再顶着"生成中"大标题和一片永久转圈
          <section className="panel">
            <h1>{messages.generationFailed}</h1>
            <p className="muted" style={{ color: 'var(--red-dark)' }}>{error}</p>
            <div className="hero-actions">
              <Link className="button primary" href={`/${currentLocale}/app`}>{messages.createMore}</Link>
              <Link className="button secondary" href={`/${currentLocale}/history`}>{messages.navHistory}</Link>
            </div>
          </section>
        ) : (
          <section className="panel">
            <span className="label">{messages.generatingTitle}</span>
            <h1>{messages.creatingImages(visibleCount)}</h1>
            <p className="muted">
              {task?.status === 'running' ? messages.taskRunning : messages.taskPreparing}
            </p>
            <div className="task-grid">
              {task
                ? task.items.map((item, index) => (
                    <div className="task-cell" key={item.id}>
                      {item.resultUrl ? (
                        <img className="result-img" src={item.resultUrl} alt={`Result ${index + 1}`} />
                      ) : (
                        <div className="pulse" />
                      )}
                      <b>{messages.imageN(index + 1)}</b>
                    </div>
                  ))
                : placeholderItems.map((item, index) => (
                    <div className="task-cell" key={item}>
                      <div className="pulse" />
                      <b>{messages.imageN(index + 1)}</b>
                    </div>
                  ))}
            </div>
          </section>
        )}
    </>
  );
}

function normalizeExpectedImages(value: number) {
  return Math.max(1, Math.min(16, Number.isFinite(value) ? Math.floor(value) : 1));
}
