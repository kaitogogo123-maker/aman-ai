'use client';

import { useEffect, useState } from 'react';

// 全局 Toast(对齐设计稿 Toast notification 帧):错误=粉红底红叉、成功=绿底勾。
// 通过 window 自定义事件触发,Toaster 挂在 layout 跨页面持久;支付错误等以后直接复用。
export type ToastType = 'error' | 'success';
type ToastItem = { id: number; message: string; type: ToastType };

let seq = 0;

export function showToast(message: string, type: ToastType = 'error') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('aman-toast', { detail: { message, type } }));
}

const ICON: Record<ToastType, React.ReactNode> = {
  error: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#e5484d" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#2e9e5b" />
      <path d="M7.5 12.4l3 3 6-6.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent).detail as { message: string; type: ToastType };
      const id = ++seq;
      setToasts((prev) => [...prev, { id, message: detail.message, type: detail.type ?? 'error' }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }
    window.addEventListener('aman-toast', onToast);
    return () => window.removeEventListener('aman-toast', onToast);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} role="status" aria-live="polite">
          <span className="toast-ic">{ICON[t.type]}</span>
          <span className="toast-msg">{t.message}</span>
          <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="close">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
