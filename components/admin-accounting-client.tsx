'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMessages, localeLabel, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/i18n';
import { formatKazakhstanAuthPhone, normalizeKazakhstanLocalPhoneInput } from '@/lib/core/auth/phone-input';
import type { AccountingReport } from '@/lib/core/admin/accounting';

type Phase = 'gate' | 'loading' | 'ready' | 'error';

// 后台不带 URL 语言前缀:按系统/浏览器语言自动选(kk/ru/zh),识别不到或其它语言默认英文。
function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'en';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const code = (raw ?? '').toLowerCase().split('-')[0];
    if (code === 'kk') return 'kk';
    if (code === 'ru') return 'ru';
    if (code === 'zh') return 'zh';
    if (code === 'en') return 'en';
  }
  return 'en';
}

export function AdminAccountingClient() {
  const [currentLocale, setCurrentLocale] = useState<SupportedLocale>('en');
  const t = getMessages(currentLocale).adminAccounting;

  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [report, setReport] = useState<AccountingReport | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [loginsPage, setLoginsPage] = useState(1);
  const [falBalance, setFalBalance] = useState<number | null | 'loading'>('loading');

  // 赠送试用额度(后台底部工具)
  const [grantPhone, setGrantPhone] = useState('');
  const [grantCount, setGrantCount] = useState('3');
  const [grantKey, setGrantKey] = useState(() => crypto.randomUUID());
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // 挂载后按浏览器语言切换(SSR 先渲染 en,避免 hydration 不一致)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentLocale(detectLocale());
  }, []);

  const loadReport = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/v1/admin/accounting');
      if (res.status === 401) {
        setPhase('gate');
        return;
      }
      if (!res.ok) {
        setPhase('error');
        return;
      }
      setReport((await res.json()) as AccountingReport);
      setUsersPage(1);
      setLedgerPage(1);
      setLoginsPage(1);
      setPhase('ready');
      // fal 余额单独异步拉(~3s 外部接口),不阻塞表格首屏
      setFalBalance('loading');
      void fetch('/api/v1/admin/fal-balance')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { credits: number | null } | null) => setFalBalance(d?.credits ?? null))
        .catch(() => setFalBalance(null));
    } catch {
      setPhase('error');
    }
  }, [setPhase, setReport, setUsersPage, setLedgerPage, setLoginsPage, setFalBalance]);

  useEffect(() => {
    // loadReport 内部同步触发 setPhase('loading'),与 orders-client 同款,按既有约定豁免
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReport();
  }, [loadReport]);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setGateError('');
    try {
      const res = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setGateError(body?.error === 'ADMIN_NOT_CONFIGURED' ? t.notConfigured : t.wrongPassword);
        return;
      }
      setPassword('');
      await loadReport();
    } catch {
      setGateError(t.wrongPassword);
    }
  }

  async function submitGrant(e: React.FormEvent) {
    e.preventDefault();
    const count = Number(grantCount);
    const authPhone = formatKazakhstanAuthPhone(grantPhone); // +7 + 10 位本地号
    if (grantPhone.length !== 10 || !authPhone || !Number.isInteger(count) || count < 1 || count > 100) {
      setGrantMsg({ ok: false, text: t.grantErrorInvalid });
      return;
    }
    setGrantBusy(true);
    setGrantMsg(null);
    try {
      const res = await fetch('/api/v1/admin/grant-credits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: authPhone, count, idempotencyKey: grantKey })
      });
      const body = (await res.json().catch(() => null)) as { balance?: number; credited?: boolean; error?: string } | null;
      if (!res.ok) {
        const text =
          body?.error === 'NUMBER_NOT_EXIST'
            ? t.grantErrorNotFound
            : body?.error === 'INVALID_INPUT'
              ? t.grantErrorInvalid
              : t.grantError;
        setGrantMsg({ ok: false, text });
        return;
      }
      // credited=false:该 idempotencyKey 已入账过(重试/重复),余额未变。诚实提示,别报成功。
      if (body?.credited === false) {
        setGrantMsg({ ok: false, text: `${t.grantNoChange} ${body?.balance ?? EMPTY}` });
        return;
      }
      setGrantMsg({ ok: true, text: `${t.grantSuccess} ${body?.balance ?? EMPTY}` });
      setGrantPhone('');
      setGrantCount('3');
      setGrantKey(crypto.randomUUID()); // 下一次赠送用新幂等 key(允许对同号有意再赠)
    } catch {
      setGrantMsg({ ok: false, text: t.grantError });
    } finally {
      setGrantBusy(false);
    }
  }

  const langSwitcher = <LangSwitcher value={currentLocale} onChange={setCurrentLocale} />;

  if (phase === 'gate') {
    return (
      <section className="admin-gate">
        {langSwitcher}
        <h1>{t.heading}</h1>
        <p className="muted">{t.subtitle}</p>
        <form className="admin-gate-form" onSubmit={submitPassword}>
          <label htmlFor="admin-password">{t.passwordLabel}</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            placeholder={t.passwordPlaceholder}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="button primary gate-submit">{t.enter}</button>
          {gateError ? <p className="admin-gate-error">{gateError}</p> : null}
        </form>
      </section>
    );
  }

  if (phase === 'loading') {
    return (
      <AccountingSkeleton
        heading={t.heading}
        subtitle={t.subtitle}
        tzNote={t.timezoneNote}
        loading={t.loading}
        switcher={langSwitcher}
      />
    );
  }

  if (phase === 'error' || !report) {
    return (
      <p className="muted">
        {t.loadError}{' '}
        <button type="button" className="history-retry" onClick={() => void loadReport()}>{t.retry}</button>
      </p>
    );
  }

  const { summary, users, ledger, logins } = report;
  const eventLabel = (type: string) =>
    type === 'register' ? t.eventRegister : type === 'login' ? t.eventLogin : type;

  return (
    <section className="admin-accounting">
      <div className="admin-head">
        <div className="admin-head-top">
          <h1>{t.heading}</h1>
          {langSwitcher}
        </div>
        <p className="muted">{t.subtitle}</p>
        <p className="admin-tz-note">{t.timezoneNote}</p>
      </div>

      <div className="admin-cards">
        <Card label={t.summaryUsers} value={fmtInt(summary.totalUsers, currentLocale)} />
        {/* 真金白银(₸/$) */}
        <Card label={t.summaryTopup} value={fmtKzt(summary.totalRevenueKzt, currentLocale)} money />
        <Card label={t.summaryRefund} value={fmtKzt(summary.totalRefundKzt, currentLocale)} money />
        <Card
          label={t.summaryFalBalance}
          value={falBalance === 'loading' ? '…' : falBalance === null ? t.falUnavailable : fmtUsd(falBalance)}
          money
        />
        {/* 生图额度(张,非钱) */}
        <Card label={t.summaryBalance} value={fmtInt(summary.totalBalance, currentLocale)} />
        <Card label={t.summaryCredits} value={fmtInt(summary.totalCredits, currentLocale)} />
        <Card label={t.summarySpent} value={fmtInt(summary.totalSpent, currentLocale)} />
      </div>

      <div className="admin-actions">
        {/* CSV 下载:原生 <a download> 直接触发浏览器下载(API 返回 attachment),不走客户端路由、不影响当前页 */}
        <a className="admin-export" href="/api/v1/admin/accounting/export?type=users" download="users.csv">{t.exportUsers}</a>
        <a className="admin-export" href="/api/v1/admin/accounting/export?type=ledger" download="ledger.csv">{t.exportLedger}</a>
        <a className="admin-export" href="/api/v1/admin/accounting/export?type=logins" download="logins.csv">{t.exportLogins}</a>
      </div>

      <h2 className="admin-section">{t.usersHeading} <span className="admin-count">{users.length}</span></h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t.colPhone}</th>
              <th>{t.colName}</th>
              <th>{t.colEmail}</th>
              <th>{t.colRegistered}</th>
              <th className="num money">{t.colPaid}</th>
              <th className="num">{t.colBalance}</th>
              <th className="num">{t.colCredited}</th>
              <th className="num">{t.colSpent}</th>
              <th className="num">{t.colLoginCount}</th>
              <th>{t.colLastLogin}</th>
              <th>{t.colCity}</th>
              <th>{t.colDevice}</th>
              <th>{t.colLang}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={13} className="admin-empty">{t.empty}</td></tr>
            ) : (
              paginate(users, usersPage).map((u) => (
                <tr key={u.id}>
                  <td className="mono" data-label={t.colPhone}>{u.phone}</td>
                  <td data-label={t.colName}>{`${u.firstName} ${u.lastName}`.trim() || EMPTY}</td>
                  <td className="muted-cell" data-label={t.colEmail}>{u.email}</td>
                  <td data-label={t.colRegistered}>{fmtDate(u.createdAt, currentLocale)}</td>
                  <td className="num money" data-label={t.colPaid}>{u.paidKzt > 0 ? fmtKzt(u.paidKzt, currentLocale) : EMPTY}</td>
                  <td className="num" data-label={t.colBalance}>{fmtInt(u.balance, currentLocale)}</td>
                  <td className="num" data-label={t.colCredited}>{fmtInt(u.credited, currentLocale)}</td>
                  <td className="num" data-label={t.colSpent}>{fmtInt(u.spent, currentLocale)}</td>
                  <td className="num" data-label={t.colLoginCount}>{fmtInt(u.loginCount, currentLocale)}</td>
                  <td className="muted-cell" data-label={t.colLastLogin}>{u.lastLogin ? fmtDateTime(u.lastLogin, currentLocale) : EMPTY}</td>
                  <td data-label={t.colCity}>{cityCountry(u.lastLoginCity, u.lastLoginCountry)}</td>
                  <td data-label={t.colDevice}>{u.lastLoginDevice ?? EMPTY}</td>
                  <td data-label={t.colLang}>{u.lastLoginLang ?? EMPTY}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager total={users.length} page={usersPage} onPage={setUsersPage} />

      <h2 className="admin-section">{t.ledgerHeading} <span className="admin-count">{ledger.length}</span></h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t.colTime}</th>
              <th>{t.colPhone}</th>
              <th>{t.colReason}</th>
              <th className="num">{t.colAmount}</th>
              <th className="num money">{t.colAmountKzt}</th>
              <th className="num">{t.colBalanceAfter}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr><td colSpan={6} className="admin-empty">{t.empty}</td></tr>
            ) : (
              paginate(ledger, ledgerPage).map((e) => (
                <tr key={e.id}>
                  <td className="muted-cell" data-label={t.colTime}>{fmtDateTime(e.createdAt, currentLocale)}</td>
                  <td className="mono" data-label={t.colPhone}>{e.phone || e.userId}</td>
                  <td data-label={t.colReason}>{e.reason}</td>
                  <td className={`num ${e.delta < 0 ? 'neg' : 'pos'}`} data-label={t.colAmount}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                  <td className="num money" data-label={t.colAmountKzt}>{e.amountKzt === null ? EMPTY : fmtKzt(e.amountKzt, currentLocale)}</td>
                  <td className="num" data-label={t.colBalanceAfter}>{fmtInt(e.balanceAfter, currentLocale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager total={ledger.length} page={ledgerPage} onPage={setLedgerPage} />

      <h2 className="admin-section">{t.loginsHeading} <span className="admin-count">{logins.length}</span></h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t.colTime}</th>
              <th>{t.colPhone}</th>
              <th>{t.colEvent}</th>
              <th>{t.colIp}</th>
              <th>{t.colLocation}</th>
              <th>{t.colDevice}</th>
              <th>{t.colIsp}</th>
              <th>{t.colLang}</th>
            </tr>
          </thead>
          <tbody>
            {logins.length === 0 ? (
              <tr><td colSpan={8} className="admin-empty">{t.empty}</td></tr>
            ) : (
              paginate(logins, loginsPage).map((e) => (
                <tr key={e.id}>
                  <td className="muted-cell" data-label={t.colTime}>{fmtDateTime(e.createdAt, currentLocale)}</td>
                  <td className="mono" data-label={t.colPhone}>{e.phone || e.userId}</td>
                  <td data-label={t.colEvent}>{eventLabel(e.type)}</td>
                  <td className="mono" data-label={t.colIp}>{e.ip ?? EMPTY}</td>
                  <td data-label={t.colLocation}>{cityCountry(e.city, e.country)}</td>
                  <td data-label={t.colDevice}>{deviceLabel(e.os, e.browser)}</td>
                  <td data-label={t.colIsp}>{e.isp ?? EMPTY}</td>
                  <td data-label={t.colLang}>{e.lang ?? EMPTY}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager total={logins.length} page={loginsPage} onPage={setLoginsPage} />

      <section className="admin-grant">
        <h2>{t.grantHeading}</h2>
        <p className="admin-grant-hint">{t.grantHint}</p>
        <form className="admin-grant-form" onSubmit={submitGrant}>
          <div className="admin-grant-field phone">
            <label htmlFor="grant-phone">{t.grantPhoneLabel}</label>
            <div className="auth-phone-control">
              <span className="auth-phone-prefix">+7</span>
              <input
                id="grant-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={grantPhone}
                placeholder={t.grantPhonePlaceholder}
                onChange={(e) => {
                  setGrantPhone(normalizeKazakhstanLocalPhoneInput(e.target.value));
                  setGrantKey(crypto.randomUUID()); // 目标一变即换幂等 key,避免复用旧 key 把新号 no-op
                }}
              />
            </div>
          </div>
          <div className="admin-grant-field count">
            <label htmlFor="grant-count">{t.grantCountLabel}</label>
            <input
              id="grant-count"
              type="number"
              min={1}
              max={100}
              value={grantCount}
              onChange={(e) => {
                setGrantCount(e.target.value);
                setGrantKey(crypto.randomUUID());
              }}
            />
          </div>
          <button type="submit" className="button primary grant-submit" disabled={grantBusy}>
            {grantBusy ? t.grantSubmitting : t.grantSubmit}
          </button>
        </form>
        {grantMsg ? <p className={`admin-grant-msg ${grantMsg.ok ? 'ok' : 'err'}`}>{grantMsg.text}</p> : null}
      </section>
    </section>
  );
}

const EMPTY = '—';
const PAGE_SIZE = 20;

function paginate<T>(items: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

// 分页:客户端切片(数据已一次取回)。适合数百~数千行;更大规模再上服务端分页。
function Pager({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="admin-pager">
      <span className="admin-pager-range">{from}–{to} / {total}</span>
      <div className="admin-pager-btns">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="prev">‹</button>
        <span className="admin-pager-page">{page} / {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="next">›</button>
      </div>
    </div>
  );
}

// 加载骨架:比裸 "Loading..." 专业,减轻慢加载的空白焦虑。
function AccountingSkeleton({
  heading,
  subtitle,
  tzNote,
  loading,
  switcher
}: {
  heading: string;
  subtitle: string;
  tzNote: string;
  loading: string;
  switcher: React.ReactNode;
}) {
  return (
    <section className="admin-accounting" aria-busy="true">
      <div className="admin-head">
        <div className="admin-head-top">
          <h1>{heading}</h1>
          {switcher}
        </div>
        <p className="muted">{subtitle}</p>
        <p className="admin-tz-note">{tzNote}</p>
      </div>
      <div className="admin-cards">
        {Array.from({ length: 7 }).map((_, i) => (
          <div className="admin-card" key={i}>
            <span className="sk sk-line sk-sm" />
            <span className="sk sk-line sk-lg" />
          </div>
        ))}
      </div>
      <div className="admin-skel-bar"><span className="sk sk-spin" />{loading}</div>
      <div className="admin-table-wrap">
        <div className="admin-skel-table">
          {Array.from({ length: 8 }).map((_, i) => (
            <span className="sk sk-row" key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function cityCountry(city: string | null, country: string | null): string {
  const parts = [city, country].filter(Boolean);
  return parts.length ? parts.join(', ') : EMPTY;
}

function deviceLabel(os: string | null, browser: string | null): string {
  const parts = [os, browser].filter(Boolean);
  return parts.length ? parts.join(' · ') : EMPTY;
}

function Card({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  return (
    <div className={`admin-card ${money ? 'money' : ''}`}>
      <span className="admin-card-label">{label}</span>
      <span className="admin-card-value">{value}</span>
    </div>
  );
}

function LangSwitcher({
  value,
  onChange
}: {
  value: SupportedLocale;
  onChange: (l: SupportedLocale) => void;
}) {
  return (
    <div className="admin-lang" role="group">
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`admin-lang-btn ${l === value ? 'active' : ''}`}
          onClick={() => onChange(l)}
        >
          {localeLabel(l)}
        </button>
      ))}
    </div>
  );
}

function intl(locale: SupportedLocale): string {
  return { ru: 'ru-KZ', kk: 'kk-KZ', en: 'en-US', zh: 'zh-CN' }[locale];
}

// 金额/额度千分位按所选语言(kk/ru 空格、en/zh 逗号),各自符合本地习惯。
function fmtInt(value: number, locale: SupportedLocale): string {
  return Math.round(value).toLocaleString(intl(locale));
}

// 真实付费金额:坚戈(₸),哈萨克标准(空格千分位、无小数)。
function fmtKzt(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(intl(locale), {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0
  }).format(value);
}

// fal.ai 账户余额是唯一真钱(USD),固定美元展示。
function fmtUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// 日期按所选语言的本地习惯显示(中文 2026/07/07、俄/哈 07.07.2026、英文 07/07/2026),
// 统一按 Astana 时区(UTC+5)——数据是哈萨克业务事件时间,与查看者所在时区无关。
const KZ_TZ = 'Asia/Almaty';

function fmtDate(iso: string, locale: SupportedLocale): string {
  try {
    return new Intl.DateTimeFormat(intl(locale), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: KZ_TZ
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function fmtDateTime(iso: string, locale: SupportedLocale): string {
  try {
    return new Intl.DateTimeFormat(intl(locale), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: KZ_TZ
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}
