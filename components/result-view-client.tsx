'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ImageLightbox, type LightboxItem } from '@/components/image-lightbox';
import { showToast } from '@/components/toast';
import { SocialLinks } from '@/components/social-links';
import type { GenerationTask } from '@/lib/core/generation/types';
import { getMessages, imageKindLabel, platformLabel, resolveLocale, type TargetPlatformCode } from '@/lib/i18n';

export function ResultViewClient({
  locale,
  taskId,
  expectedImages = 1
}: {
  locale: string;
  taskId: string;
  expectedImages?: number;
}) {
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const router = useRouter();
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pct, setPct] = useState(8);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackShown = useRef(false);
  const taskError = task?.items.find((item) => item.error)?.error ?? null;
  const loadingCount = task?.items.length ?? normalizeExpectedImages(expectedImages);

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;
    // 动态退避:首拍 900ms(尽早捕获完成),逐步拉到 2.5s 上限降负载
    let delay = 900;

    async function loadTask() {
      const response = await fetch(`/api/v1/task/${taskId}`);
      if (!response.ok) return;
      const data = (await response.json()) as { task: GenerationTask };
      if (!active) return;
      setTask(data.task);

      if (data.task.status === 'running' || data.task.status === 'queued') {
        timeoutId = window.setTimeout(loadTask, delay);
        delay = Math.min(delay + 300, 2500);
      }
    }

    loadTask();
    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [taskId]);

  const selected = task?.items[selectedIndex];
  const readyItems = task?.items.filter((item) => item.resultUrl) ?? [];
  const isLoading = !task || task.status === 'queued' || task.status === 'running';
  // 真正在生成(排队/进行中)才显示"生成中 + 进度%";仅在拉取已完成记录时显示"加载中"
  const isGenerating = Boolean(task && (task.status === 'queued' || task.status === 'running'));
  const isFailed = task?.status === 'failed' || task?.status === 'canceled';

  // 生成进度百分比:加载中向 ~92% 缓慢推进(后端到位后可换成真实进度)
  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setPct((p) => (p < 92 ? p + Math.max(1, Math.round((92 - p) / 12)) : p)), 600);
    return () => clearInterval(id);
  }, [isLoading]);

  // 生成完成(首次)→ 弹结果反馈 modal
  useEffect(() => {
    if (!feedbackShown.current && !isLoading && !isFailed && readyItems.length > 0) {
      feedbackShown.current = true;
      setFeedbackOpen(true);
    }
  }, [isLoading, isFailed, readyItems.length]);

  function downloadAll() {
    // 多张图错开触发，避免浏览器把同步连续下载拦截成只下第一张
    readyItems.forEach((item, index) => {
      const name = `aman-${task?.id ?? taskId}-${index + 1}.png`;
      const url = buildDownloadUrl(item.resultUrl!, name);
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, index * 400);
    });
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url, title: 'Aman AI' });
      } else {
        await navigator.clipboard.writeText(url);
        showToast(messages.toastLinkCopied, 'success');
      }
    } catch {
      /* 用户取消分享，忽略 */
    }
  }

  async function deleteTask() {
    if (!window.confirm(messages.deleteConfirm)) return;
    setIsDeleting(true);
    const response = await fetch(`/api/v1/task/${taskId}`, { method: 'DELETE' });
    if (response.ok) {
      router.push(`/${currentLocale}/history`);
    } else {
      setIsDeleting(false);
    }
  }

  return (
    <>
        {isLoading ? (
          <div className="result-detail result-detail--loading" role="status" aria-live="polite">
            <div className="result-detail-media">
              <div className="result-image-skeleton result-gen-card">
                <svg className="result-gen-star" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l2.2 6.4L21 10.2l-5.4 3.9L17.6 21 12 17l-5.6 4 2-6.9L3 10.2l6.8-1.8z" />
                </svg>
                <span className="result-gen-label">{isGenerating ? messages.generatingTitle : messages.loadingLabel}…</span>
                {isGenerating ? (
                  <>
                    <div className="result-gen-bar"><span style={{ width: `${pct}%` }} /></div>
                    <span className="result-gen-pct">{pct}%</span>
                  </>
                ) : null}
              </div>
              {loadingCount > 1 ? (
                <div className="result-detail-thumbs" aria-hidden="true">
                  {Array.from({ length: Math.min(loadingCount, 5) }, (_, index) => (
                    <span key={index} className="result-thumb-skeleton" />
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <span className="label">{messages.resultTitle}</span>
              <h1 className="result-detail-title">{messages.resultLoading}</h1>
              {isGenerating ? <p className="result-detail-desc">{messages.taskRunning}</p> : null}
              <div className="result-skeleton-lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        ) : isFailed ? (
          <section className="panel">
            <h1>{messages.generationFailed}</h1>
            <p className="muted" style={{ color: 'var(--red-dark)' }}>{taskError ?? messages.generationFailed}</p>
            <div className="hero-actions">
              <Link className="button primary" href={`/${currentLocale}/app`}>{messages.createMore}</Link>
            </div>
          </section>
        ) : (
          <div className="result-detail">
            <div className="result-detail-media">
              {selected?.resultUrl ? (
                <img
                  className="result-detail-img"
                  src={selected.resultUrl}
                  alt={imageKindLabel(currentLocale, task!.settings.mode, selected.kind)}
                  onClick={() => setLightboxIndex(selectedIndex)}
                />
              ) : null}
              {readyItems.length > 1 ? (
                <div className="result-detail-thumbs">
                  {task!.items.map((item, index) =>
                    item.resultUrl ? (
                      <button
                        key={item.id}
                        type="button"
                        className={selectedIndex === index ? 'active' : ''}
                        onClick={() => setSelectedIndex(index)}
                        aria-label={imageKindLabel(currentLocale, task!.settings.mode, item.kind)}
                      >
                        <img src={item.resultUrl} alt="" />
                      </button>
                    ) : null
                  )}
                </div>
              ) : null}
              <div className="result-detail-actions">
                <button className="button primary" type="button" onClick={downloadAll}>
                  {messages.downloadAllLabel}
                </button>
                <button className="button secondary" type="button" onClick={share}>
                  {messages.shareLabel}
                </button>
              </div>
            </div>

            <div>
              {task!.settings.category ? (
                <span className="history-card-badge result-detail-badge">{task!.settings.category}</span>
              ) : null}
              {(() => {
                const titleText = taskTitle(task!, messages.cardTitleFallback);
                const descText = truncate(task!.settings.productInfo ?? '', 240);
                return (
                  <>
                    <h1 className="result-detail-title">{titleText}</h1>
                    {/* 描述与标题不同才显示,避免短文案标题/描述完全重复 */}
                    {descText && descText !== titleText ? (
                      <p className="result-detail-desc">{descText}</p>
                    ) : null}
                  </>
                );
              })()}
              <div className="result-meta-list">
                <div className="result-meta-item">
                  <span className="result-meta-ic" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                    </svg>
                  </span>
                  <div className="result-meta-text">
                    <span>{messages.platformMetaLabel}</span>
                    <b>{platformLabel(currentLocale, (task!.settings.platform ?? 'general') as TargetPlatformCode)}</b>
                  </div>
                </div>
                <div className="result-meta-item">
                  <span className="result-meta-ic" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
                      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
                    </svg>
                  </span>
                  <div className="result-meta-text">
                    <span>{messages.dateCreatedLabel}</span>
                    <b>{formatDate(task!.createdAt, currentLocale)}</b>
                  </div>
                </div>
                <div className="result-meta-item">
                  <span className="result-meta-ic" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
                      <circle cx="8.5" cy="10" r="1.6" />
                      <path d="M21 16l-5-5-9 8" />
                    </svg>
                  </span>
                  <div className="result-meta-text">
                    <span>{messages.imagesMetaLabel}</span>
                    <b>{messages.photoCount(task!.items.length)}</b>
                  </div>
                </div>
              </div>
              <div className="result-detail-delete">
                <button className="button danger" type="button" onClick={deleteTask} disabled={isDeleting}>
                  {messages.deleteLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      {lightboxIndex !== null && task ? (() => {
        const successItems = task.items.filter((item) => item.resultUrl);
        if (successItems.length === 0) return null;
        return (
          <ImageLightbox
            items={successItems.map<LightboxItem>((item, index) => ({
              url: item.resultUrl!,
              alt: `${imageKindLabel(currentLocale, task.settings.mode, item.kind)} ${index + 1}`,
              caption: `${index + 1} / ${successItems.length} · ${imageKindLabel(currentLocale, task.settings.mode, item.kind)}`
            }))}
            activeIndex={Math.min(lightboxIndex, successItems.length - 1)}
            onClose={() => setLightboxIndex(null)}
            onIndexChange={setLightboxIndex}
          />
        );
      })() : null}

      {feedbackOpen && readyItems[0]?.resultUrl ? (
        <div className="feedback-backdrop" role="presentation" onClick={() => setFeedbackOpen(false)}>
          <div className="feedback-modal" role="dialog" aria-modal="true" aria-label={messages.feedbackTitle} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="feedback-close" aria-label="Close" onClick={() => setFeedbackOpen(false)}>
              ×
            </button>
            <img className="feedback-img" src={readyItems[0].resultUrl!} alt="" />
            <h2 className="feedback-title">{messages.feedbackTitle}</h2>
            <p className="feedback-sub">{messages.feedbackSubtitle}</p>
            <SocialLinks includeWhatsApp />
          </div>
        </div>
      ) : null}
    </>
  );
}

function normalizeExpectedImages(value: number) {
  return Math.max(1, Math.min(16, Number.isFinite(value) ? Math.floor(value) : 1));
}

function buildDownloadUrl(resultUrl: string, name: string) {
  return `/api/v1/download?url=${encodeURIComponent(resultUrl)}&name=${encodeURIComponent(name)}`;
}

function taskTitle(task: GenerationTask, fallback: string): string {
  const info = (task.settings.productInfo ?? '').trim();
  if (!info) return fallback;
  const firstLine = info.split('\n').map((l) => l.replace(/\[.*?\][:：]?/g, '').trim()).find(Boolean);
  if (!firstLine) return fallback;
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

function truncate(text: string, max: number) {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return iso.slice(0, 10);
  }
}
