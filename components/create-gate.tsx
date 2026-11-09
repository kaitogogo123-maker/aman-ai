'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchSessionLoginFlag, readCachedLoginFlag, syncCachedLoginFlag } from '@/lib/core/auth/client-auth-state';
import { getMessages, resolveLocale } from '@/lib/i18n';

// 创建页拦截门(客户要求):未登录时,任何生成相关操作(上传/选项/AI填写/选图类型/平台/画幅/生成)
// 都先弹「Создание карточек доступно после входа или регистрации」+ Войти / Регистрация。
// 登录态先用 localStorage 快速判断,再用 /me 校准,避免 httpOnly session 存在但缓存丢失时误拦截。
export function CreateGate({ locale, children }: { locale: string; children: React.ReactNode }) {
  const cl = resolveLocale(locale);
  const t = getMessages(cl).auth;
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoggedIn(readCachedLoginFlag());

    let active = true;
    fetchSessionLoginFlag()
      .then((nextLoggedIn) => {
        if (!active) return;
        syncCachedLoginFlag(undefined, nextLoggedIn);
        setLoggedIn(nextLoggedIn);
      })
      .catch(() => {
        if (!active) return;
        setLoggedIn(readCachedLoginFlag());
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // 捕获阶段拦截:未登录时阻断所有子元素点击,弹门
  function intercept(e: React.MouseEvent) {
    if (loggedIn) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  return (
    <>
      <div onClickCapture={intercept}>{children}</div>
      {open ? (
        <div className="gate-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="gate-modal" role="dialog" aria-modal="true" aria-label={t.gateTitle} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="gate-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
            <h2 className="gate-title">{t.gateTitle}</h2>
            <Link className="button primary gate-btn" href={`/${cl}/login`}>
              {t.gateLoginBtn}
            </Link>
            <Link className="button primary gate-btn" href={`/${cl}/register`}>
              {t.gateRegisterBtn}
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
