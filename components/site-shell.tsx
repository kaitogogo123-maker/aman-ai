'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { showToast } from '@/components/toast';
import { getMessages, resolveLocale } from '@/lib/i18n';

// 共享外壳:header / footer / 底部导航统一放这里,跨页面切换时保持挂载、不重建,
// 彻底消除"切换页面顶部 header / 创建↔历史切换跳动/闪烁"(各页原来各自渲染一份 header → 每次导航整树重挂载)。
// 页面组件只渲染各自内容(去掉 main/page/SiteHeader/footer/bottom-nav)。
export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const parts = pathname.split('/').filter(Boolean); // ['en','app',...]
  const locale = resolveLocale(parts[0] ?? 'ru');
  const seg = parts[1] ?? ''; // '' landing | app | history | result | task | pricing | contacts | login | register | recover
  const rest = parts.length > 1 ? '/' + parts.slice(1).join('/') : ''; // 给 LocaleSwitcher 拼当前页
  const m = getMessages(locale);
  const query = searchParams.toString();
  const qs = query ? `?${query}` : '';
  const paymentStatus = searchParams.get('payment');

  useEffect(() => {
    let toastTimer: number | undefined;
    if (paymentStatus === 'success') {
      toastTimer = window.setTimeout(() => showToast(m.paymentPendingConfirmation, 'success'), 0);
      // 回跳后结算:扫已付套餐订单入账,完成后通知头部刷新余额(幂等,可安全重复)
      fetch('/api/v1/payments/settle', { method: 'POST' })
        .then(() => window.dispatchEvent(new CustomEvent('aman:balance-changed')))
        .catch(() => {
          /* 忽略;下次进页面/刷新仍会结算 */
        });
    } else if (paymentStatus === 'failed') {
      toastTimer = window.setTimeout(() => showToast(m.paymentFailed, 'error'), 0);
    }
    return () => {
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
    };
  }, [m.paymentFailed, m.paymentPendingConfirmation, paymentStatus]);

  // 兜底结算:每次应用加载跑一次(幂等)。覆盖"付了款但没跳回 ?payment=success"
  // (关页面/回跳失败)的情况——订单在 aman 侧已 PAID,补上入账。未登录则 /settle 直接 401 无害。
  useEffect(() => {
    fetch('/api/v1/payments/settle', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { creditedCount?: number } | null) => {
        if (d?.creditedCount) window.dispatchEvent(new CustomEvent('aman:balance-changed'));
      })
      .catch(() => {
        /* 忽略 */
      });
  }, []);

  const isWorkspace = seg === 'app' || seg === 'history' || seg === 'result' || seg === 'task';
  const isMarketing = seg === '' || seg === 'pricing' || seg === 'contacts';

  // header 各页参数(由路径推导;header 实例在 layout 里持久,切页面只更新 props 不重建)
  let appNav: 'create' | 'history' | undefined;
  let backHref: string | undefined;
  let backLabel: string | undefined;
  let showPhone = true;
  if (seg === 'app') {
    appNav = 'create';
    backHref = `/${locale}`;
  } else if (seg === 'history') {
    appNav = 'history';
    backHref = `/${locale}/app`;
  } else if (seg === 'result') {
    appNav = 'create';
    backHref = `/${locale}/history`;
    backLabel = m.backToHistory;
  } else if (seg === 'task') {
    appNav = 'create';
  } else if (seg === '') {
    showPhone = false; // 落地页头部不显示电话(原 landing 行为)
  }

  // 底栏「创建」:在 /app 已是当前页,点它触发生成(派事件给 tamga-app);其余页是去 /app 的链接
  const onCreateTap = (e: React.MouseEvent) => {
    if (seg === 'app') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('aman:create-tap'));
    }
  };

  return (
    <main className={isWorkspace ? 'app-shell' : 'shell'}>
      <div className="page">
        <SiteHeader
          locale={locale}
          pathname={rest + qs}
          appNav={appNav}
          backHref={backHref}
          backLabel={backLabel}
          showPhone={showPhone}
        />
        {children}
      </div>

      {isMarketing ? <SiteFooter locale={locale} /> : null}

      {isWorkspace ? (
        <nav className="bottom-nav">
          {/* 创建流(app/result/task)高亮「创建」,与桌面顶部 toggle 的 appNav=create 一致 */}
          <Link className={seg === 'app' || seg === 'result' || seg === 'task' ? 'active' : ''} href={`/${locale}/app`} onClick={onCreateTap}>
            {m.navCreate}
          </Link>
          <Link className={seg === 'history' ? 'active' : ''} href={`/${locale}/history`}>
            {m.navHistory}
          </Link>
        </nav>
      ) : null}
    </main>
  );
}
