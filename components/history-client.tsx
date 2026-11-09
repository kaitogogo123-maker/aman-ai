'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DatePicker } from '@/components/date-picker';
import type { GenerationTask } from '@/lib/core/generation/types';
import { getMessages, platformLabel, resolveLocale, type SupportedLocale, type TargetPlatformCode } from '@/lib/i18n';

// 模块级缓存:同一会话内重复进入历史时,先用上次结果秒开,再后台静默刷新(stale-while-revalidate),
// 不再每次都走 loading。页面整刷才清空。
let historyCache: GenerationTask[] | null = null;

// 加载失败文案(罕见:/api/v1/tasks 网络错/500)。显示错误+重试,而非误导的"还没有任务"。
const ERR_COPY: Record<SupportedLocale, { msg: string; retry: string }> = {
  ru: { msg: 'Не удалось загрузить историю.', retry: 'Повторить' },
  kk: { msg: 'Тарихты жүктеу мүмкін болмады.', retry: 'Қайталау' },
  en: { msg: 'Failed to load history.', retry: 'Retry' },
  zh: { msg: '加载历史失败。', retry: '重试' }
};

export function HistoryClient({
  locale,
  initialTasks = [],
  initialLoading = false
}: {
  locale: string;
  initialTasks?: GenerationTask[];
  initialLoading?: boolean;
}) {
  const currentLocale = resolveLocale(locale);
  const messages = getMessages(currentLocale);
  const seed = initialTasks.length > 0 ? initialTasks : historyCache ?? [];
  const [tasks, setTasks] = useState<GenerationTask[]>(seed);
  // 骨架延迟显示:请求够快(尤其空历史秒回)就不闪骨架;loaded 门控空态,避免反向闪"还没有任务"
  const [loaded, setLoaded] = useState(seed.length > 0);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [recentBatch, setRecentBatch] = useState<{ count: number } | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem('tamga_recent_batch');
      sessionStorage.removeItem('tamga_recent_batch');
    } catch {
      return;
    }
    if (!raw) return;

    let parsed: { count: number; ts: number };
    try {
      parsed = JSON.parse(raw) as { count: number; ts: number };
    } catch {
      return;
    }
    if (Date.now() - parsed.ts >= 15000) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentBatch({ count: parsed.count });
    const timer = setTimeout(() => setRecentBatch(null), 6000);
    return () => clearTimeout(timer);
  }, []);

  async function loadTasks(showSpinner = false) {
    // 骨架延迟 250ms:请求在此之前完成(尤其空历史秒回)就不显示骨架,避免一闪
    let skeletonTimer: ReturnType<typeof setTimeout> | undefined;
    if (showSpinner) skeletonTimer = setTimeout(() => setShowSkeleton(true), 250);
    setLoadError(false);
    try {
      const response = await fetch('/api/v1/tasks');
      if (skeletonTimer) clearTimeout(skeletonTimer);
      setShowSkeleton(false);
      if (!response.ok) {
        // 加载失败:显示错误+重试,而非误导性的"还没有任务"
        setLoadError(true);
        setLoaded(true);
        return;
      }
      const data = (await response.json()) as { tasks: GenerationTask[] };
      historyCache = data.tasks; // 写入缓存供下次秒开
      setTasks(data.tasks);
      setLoaded(true);
    } catch {
      if (skeletonTimer) clearTimeout(skeletonTimer);
      setShowSkeleton(false);
      setLoadError(true);
      setLoaded(true);
    }
  }

  useEffect(() => {
    // 挂载即后台刷新;无缓存时才考虑骨架(且延迟显示,空历史秒回不闪)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks(initialLoading && seed.length === 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const day = task.createdAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (category && !taskMatchesCategory(task, category)) return false;
      return true;
    });
  }, [tasks, dateFrom, dateTo, category]);

  const categories = [messages.allCategoryLabel, ...messages.quickChipsCategories];

  return (
    <>
        <div className="history-head">
          <h1>{messages.historyHeading}</h1>
          <p className="history-total">
            {messages.historyTotalLabel}: <b>{tasks.length}</b>
          </p>
        </div>

        {recentBatch ? (
          <div className="history-banner" role="status">{messages.multiLangBatchCreated(recentBatch.count)}</div>
        ) : null}

        <div className="history-filters">
          <div className="history-date-row">
            <div className="history-date-field">
              <span className="label">{messages.dateFromLabel}</span>
              <DatePicker locale={currentLocale} value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
            </div>
            <div className="history-date-field">
              <span className="label">{messages.dateToLabel}</span>
              <DatePicker locale={currentLocale} value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
            </div>
            <button
              className="button history-reset"
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setCategory('');
              }}
            >
              {messages.resetLabel}
            </button>
          </div>
          <div className="history-date-field">
            <span className="label">{messages.categoryLabel}</span>
            <div className="history-cat-chips">
              {categories.map((cat, index) => {
                const value = index === 0 ? '' : cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`chip ${category === value ? 'active' : ''}`}
                    onClick={() => setCategory(value)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {showSkeleton && tasks.length === 0 ? (
          <div className="history-grid" role="status" aria-live="polite" aria-label={messages.loadingLabel}>
            {[0, 1, 2].map((index) => (
              <div className="history-card" key={index}>
                <div className="history-card-img history-card-img--skeleton" />
                <div className="history-card-body">
                  <div className="history-card-skeleton">
                    <b />
                    <small />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div className="history-grid">
            {filtered.map((task) => {
              const cardImage = task.items[0]?.resultUrl;
              // 客户明确要求:图获取不到(无可显示成品图)就置灰「查看」+ 整个图片模块不可点击。
              const canOpen = Boolean(cardImage);
              const imageInner = cardImage ? (
                <img className="history-card-img" src={cardImage} alt="" loading="lazy" decoding="async" />
              ) : (
                <div className="history-card-img history-card-img--empty" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2.5" />
                    <circle cx="8.5" cy="9.5" r="1.6" />
                    <path d="M21 16l-5.5-5.5L4 21" />
                  </svg>
                </div>
              );
              return (
                <article className="history-card" key={task.id}>
                  {canOpen ? (
                    <Link className="history-card-imglink" href={`/${currentLocale}/result/${task.id}`} aria-label={messages.viewLabel}>
                      {imageInner}
                    </Link>
                  ) : (
                    imageInner
                  )}
                  <div className="history-card-body">
                    {deriveCategory(task, messages.quickChipsCategories) ? (
                      <span className="history-card-badge">{deriveCategory(task, messages.quickChipsCategories)}</span>
                    ) : null}
                    <h2 className="history-card-title">{taskTitle(task, messages.cardTitleFallback)}</h2>
                    <div className="history-card-meta">
                      <span>
                        <svg className="history-card-meta-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
                        </svg>
                        {platformLabel(currentLocale, (task.settings.platform ?? 'general') as TargetPlatformCode)}
                      </span>
                      <span>
                        <svg className="history-card-meta-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
                          <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
                        </svg>
                        {formatDate(task.createdAt, currentLocale)}
                      </span>
                    </div>
                    {canOpen ? (
                      <Link className="button primary" href={`/${currentLocale}/result/${task.id}`}>
                        {messages.viewLabel}
                      </Link>
                    ) : (
                      <button className="button primary" type="button" disabled>
                        {messages.viewLabel}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {loaded && loadError ? (
          <p className="muted">
            {ERR_COPY[currentLocale].msg}{' '}
            <button type="button" className="history-retry" onClick={() => loadTasks(true)}>
              {ERR_COPY[currentLocale].retry}
            </button>
          </p>
        ) : loaded && filtered.length === 0 ? (
          <p className="muted">{messages.noTasks}</p>
        ) : null}
    </>
  );
}

// 分类筛选:优先用结构化 settings.category 精确匹配;旧任务回退 productInfo 文本匹配
function taskMatchesCategory(task: GenerationTask, category: string) {
  if (task.settings.category) return task.settings.category === category;
  return (task.settings.productInfo ?? '').toLowerCase().includes(category.toLowerCase());
}

// 分类:优先用结构化 settings.category(创建时选的分类芯片);旧任务无此字段时回退 productInfo 文本匹配
function deriveCategory(task: GenerationTask, categories: readonly string[]): string | null {
  if (task.settings.category) return task.settings.category;
  const info = (task.settings.productInfo ?? '').toLowerCase();
  return categories.find((c) => info.includes(c.toLowerCase())) ?? null;
}

// 从 productInfo 提取标题：取首个非空、去掉 [方括号标签] 的片段
function taskTitle(task: GenerationTask, fallback: string): string {
  const info = (task.settings.productInfo ?? '').trim();
  if (!info) return fallback;
  const firstLine = info.split('\n').map((l) => l.replace(/\[.*?\][:：]?/g, '').trim()).find(Boolean);
  if (!firstLine) return fallback;
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
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
