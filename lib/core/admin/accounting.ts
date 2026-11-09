import type { QueryClient } from '@/lib/core/generation/postgres-task-store';
import { priceForCount } from '@/lib/core/pricing';

// 本地支付/额度流水为会计权威源(Marketplace 订单只能按当前用户 token 查,无法全量)。
// 该模块只读聚合 auth_users / credit_ledger / auth_events,不写任何数据。
//
// 🔴 钱 vs 张数:credit_ledger 的 delta/balance 是「生图额度(张)」不是钱。
//    真实付费金额(₸)由付费入账(reason=topup)的张数经官方价目表 priceForCount 还原
//    (下单时 customAmount=priceForCount(images),入账张数=该 images,故可精确重建)。
//    余额/累计入账/生成扣费仍是张数;付费金额/退款金额为真实 ₸。

export interface AccountingUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  balance: number; // 生图额度余额(张)
  createdAt: string;
  credited: number; // 累计入账额度(张)
  spent: number; // 累计生成消耗(张)
  paidKzt: number; // 真实付费金额(₸)= 该用户 topup 张数经价目表还原
  refundedKzt: number; // 真实退款金额(₸)
  loginCount: number;
  lastLogin: string | null;
  lastLoginCity: string | null; // 最近一次事件(登录/注册)的城市/国家/设备(取自 auth_events.metadata)
  lastLoginCountry: string | null;
  lastLoginIp: string | null;
  lastLoginDevice: string | null; // "iOS · Safari" 形式
  lastLoginLang: string | null; // 最近一次事件的浏览器语言偏好(如 ru / kk / zh)
}

// 单条登录/注册审计记录,含从 metadata 解出的地理/设备上下文。
export interface LoginEntry {
  id: string;
  userId: string;
  phone: string;
  firstName: string;
  lastName: string;
  type: string; // login | register
  provider: string | null;
  createdAt: string;
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  isp: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  lang: string | null; // 浏览器语言偏好(Accept-Language 首选,如 ru / kk / zh)
}

export interface LedgerEntry {
  id: string;
  userId: string;
  phone: string;
  firstName: string;
  lastName: string;
  delta: number; // 额度变动(张):+入账 / −生成消耗
  reason: string;
  balanceAfter: number; // 变动后额度余额(张)
  amountKzt: number | null; // 真实金额(₸):仅 topup/refund 有钱,生成消耗为 null
  createdAt: string;
}

export interface AccountingSummary {
  totalUsers: number;
  // —— 真金白银(₸)——
  totalRevenueKzt: number; // 付费收入(topup 张数经价目表还原)
  totalRefundKzt: number; // 退款金额(₸)
  falCredits: number | null; // fal.ai 账户余额(USD 美元),拉取失败为 null
  // —— 生图额度(张,非钱)——
  totalBalance: number; // 当前额度余额合计(张)
  totalCredits: number; // 累计发放额度(正 delta 合计,含免费/测试,张)
  totalSpent: number; // 累计生成消耗(张)
}

export interface AccountingReport {
  summary: AccountingSummary;
  users: AccountingUser[];
  ledger: LedgerEntry[];
  logins: LoginEntry[];
}

export type FalBalanceFetcher = () => Promise<{ credits: number } | null>;

const USERS_SQL = `
  -- accounting:users
  select u.id, u.phone, u.first_name, u.last_name, u.email, u.balance, u.created_at,
         coalesce(l.credited, 0) as credited,
         coalesce(l.spent, 0) as spent,
         coalesce(e.login_count, 0) as login_count,
         ll.created_at as last_login,
         ll.metadata as last_login_meta
  from auth_users u
  left join (
    select user_id,
           sum(case when delta > 0 then delta else 0 end) as credited,
           sum(case when delta < 0 then -delta else 0 end) as spent
    from credit_ledger
    group by user_id
  ) l on l.user_id = u.id
  left join (
    -- 注册即首次登录:register 也计入登录次数(auth_events 仅有 login/register 两类)。
    select user_id, count(*) filter (where type in ('login', 'register')) as login_count
    from auth_events
    group by user_id
  ) e on e.user_id = u.id
  left join lateral (
    -- 最近登录/城市/设备取最近一条任意事件:刚注册用户只有 register 事件,其 metadata 同样带地理/设备。
    select created_at, metadata
    from auth_events
    where user_id = u.id and type in ('login', 'register')
    order by created_at desc
    limit 1
  ) ll on true
  order by u.created_at desc
`;

const LOGINS_SQL = `
  -- accounting:logins
  select ev.id, ev.user_id, u.phone, u.first_name, u.last_name,
         ev.type, ev.created_at, ev.metadata
  from auth_events ev
  left join auth_users u on u.id = ev.user_id
  order by ev.created_at desc
  limit $1
`;

const SUMMARY_SQL = `
  -- accounting:summary
  select sum(case when delta > 0 then delta else 0 end) as credits,
         sum(case when delta < 0 then -delta else 0 end) as spent
  from credit_ledger
`;

// 付费/退款每笔金额:优先用落库的实付 ₸(amount_kzt),老行无则按价目表 priceForCount 还原。笔数少,不设上限。
const MONEY_SQL = `
  -- accounting:money
  select user_id, reason, delta, amount_kzt
  from credit_ledger
  where reason in ('topup', 'refund') and delta > 0
`;


const LEDGER_SQL = `
  -- accounting:ledger
  -- balance_after 按用户流水累计 delta 实时算,不信任落库列:creditOnce(topup/free_trial)
  -- 的 CTE 把 balance_after 恒写成 0(后插入的 ledger 行对同语句里的 fix 更新不可见),
  -- 这里改在读取侧算,覆盖历史+新行,且完全不动写入/支付路径(零风险)。
  -- 窗口在内层对全量流水按用户+时间累计,再由外层排序截断分页。
  select id, user_id, phone, first_name, last_name, delta, reason, amount_kzt, created_at, balance_after
  from (
    select le.id, le.user_id, u.phone, u.first_name, u.last_name,
           le.delta, le.reason, le.amount_kzt, le.created_at,
           sum(le.delta) over (
             partition by le.user_id
             order by le.created_at, le.id
             rows between unbounded preceding and current row
           ) as balance_after
    from credit_ledger le
    left join auth_users u on u.id = le.user_id
  ) t
  order by created_at desc
  limit $1
`;

interface UserRow {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  email: string;
  balance: number;
  created_at: string;
  credited: number;
  spent: number;
  login_count: number;
  last_login: string | null;
  last_login_meta: unknown;
}

interface LoginRow {
  id: string;
  user_id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  type: string;
  created_at: string;
  metadata: unknown;
}

interface LedgerRow {
  id: string;
  user_id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  delta: number;
  reason: string;
  balance_after: number;
  amount_kzt: number | null;
  created_at: string;
}

interface SummaryRow {
  credits: number | null;
  spent: number | null;
}

interface MoneyRow {
  user_id: string;
  reason: string;
  delta: number;
  amount_kzt: number | null;
}

export type ReportSection = 'users' | 'ledger' | 'logins';

export async function createAccountingReport({
  client,
  fal,
  ledgerLimit = 1000,
  loginLimit = 1000,
  sections
}: {
  client: QueryClient;
  fal: FalBalanceFetcher;
  ledgerLimit?: number;
  loginLimit?: number;
  sections?: ReportSection[]; // 仅取指定数据集(CSV 导出用),缺省全取(页面用)
}): Promise<AccountingReport> {
  // 不在热路径建表/补列:auth_events 由登录审计写入路径建、amount_kzt 由 auth store 补列(见 postgres-auth-store)。
  // 只读侧直接并发查询;表/列缺失时 safeQuery 优雅返回空,避免每次加载多 2 次串行 Neon 往返拖慢。
  const want = (s: ReportSection) => !sections || sections.includes(s);
  const empty = <T,>() => Promise.resolve([] as T[]);
  // money 仅在需要用户/汇总(付费金额、收入)时查;单独导流水/登录时跳过。
  const needMoney = want('users');
  const [userRows, summaryRows, ledgerRows, loginRows, moneyRows, falBalance] = await Promise.all([
    want('users') ? safeQuery<UserRow>(client, USERS_SQL) : empty<UserRow>(),
    want('users') ? safeQuery<SummaryRow>(client, SUMMARY_SQL) : empty<SummaryRow>(),
    want('ledger') ? safeQuery<LedgerRow>(client, LEDGER_SQL, [ledgerLimit]) : empty<LedgerRow>(),
    want('logins') ? safeQuery<LoginRow>(client, LOGINS_SQL, [loginLimit]) : empty<LoginRow>(),
    needMoney ? safeQuery<MoneyRow>(client, MONEY_SQL) : empty<MoneyRow>(),
    fal().catch(() => null)
  ]);

  // 逐笔经价目表还原真实 ₸,按用户汇总(付费/退款分开)。
  const moneyByUser = new Map<string, { paid: number; refunded: number }>();
  let totalRevenueKzt = 0;
  let totalRefundKzt = 0;
  for (const row of moneyRows) {
    // 优先用落库实付 ₸;老行无则按价目表还原。
    const kzt = row.amount_kzt != null ? num(row.amount_kzt) : priceForCount(num(row.delta));
    const acc = moneyByUser.get(row.user_id) ?? { paid: 0, refunded: 0 };
    if (row.reason === 'refund') {
      acc.refunded += kzt;
      totalRefundKzt += kzt;
    } else {
      acc.paid += kzt;
      totalRevenueKzt += kzt;
    }
    moneyByUser.set(row.user_id, acc);
  }

  const users = userRows.map((row) => {
    const money = moneyByUser.get(row.id);
    return { ...rowToUser(row), paidKzt: money?.paid ?? 0, refundedKzt: money?.refunded ?? 0 };
  });
  const ledger = ledgerRows.map(rowToLedger);
  const logins = loginRows.map(rowToLogin);
  const summaryRow = summaryRows[0];

  const summary: AccountingSummary = {
    totalUsers: users.length,
    totalRevenueKzt,
    totalRefundKzt,
    falCredits: falBalance ? Number(falBalance.credits) : null,
    totalBalance: users.reduce((acc, u) => acc + u.balance, 0),
    totalCredits: num(summaryRow?.credits),
    totalSpent: num(summaryRow?.spent)
  };

  return { summary, users, ledger, logins };
}

async function safeQuery<T>(client: QueryClient, text: string, params?: unknown[]): Promise<T[]> {
  try {
    return await client.query<T>(text, params);
  } catch (e) {
    if (isUndefinedTable(e)) return [];
    throw e;
  }
}

function isUndefinedTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === '42P01' || /does not exist/i.test(err?.message ?? '');
}

function rowToUser(row: UserRow): AccountingUser {
  const meta = readMeta(row.last_login_meta);
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    balance: num(row.balance),
    createdAt: new Date(row.created_at).toISOString(),
    credited: num(row.credited),
    spent: num(row.spent),
    paidKzt: 0, // 由 createAccountingReport 用 moneyByUser 覆盖
    refundedKzt: 0,
    loginCount: num(row.login_count),
    lastLogin: row.last_login ? new Date(row.last_login).toISOString() : null,
    lastLoginCity: metaStr(meta.city),
    lastLoginCountry: metaStr(meta.country),
    lastLoginIp: metaStr(meta.ip),
    lastLoginDevice: deviceSummary(meta),
    lastLoginLang: metaStr(meta.lang)
  };
}

function rowToLogin(row: LoginRow): LoginEntry {
  const meta = readMeta(row.metadata);
  return {
    id: row.id,
    userId: row.user_id,
    phone: row.phone ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    type: row.type,
    provider: metaStr(meta.provider),
    createdAt: new Date(row.created_at).toISOString(),
    ip: metaStr(meta.ip),
    country: metaStr(meta.country),
    city: metaStr(meta.city),
    region: metaStr(meta.region),
    timezone: metaStr(meta.timezone),
    isp: metaStr(meta.isp),
    os: metaStr(meta.os),
    browser: metaStr(meta.browser),
    device: metaStr(meta.device),
    lang: metaStr(meta.lang)
  };
}

// metadata 是 jsonb:驱动多半已解析成对象,兜底再 JSON.parse 一次。
function readMeta(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function metaStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function deviceSummary(meta: Record<string, unknown>): string | null {
  const parts = [metaStr(meta.os), metaStr(meta.browser)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function rowToLedger(row: LedgerRow): LedgerEntry {
  const delta = num(row.delta);
  // 钱金额:优先落库实付 ₸;老行无则仅对付费/退款按价目表还原,生成消耗非钱事件 → null。
  const amountKzt =
    row.amount_kzt != null
      ? num(row.amount_kzt)
      : (row.reason === 'topup' || row.reason === 'refund') && delta > 0
        ? priceForCount(delta)
        : null;
  return {
    id: row.id,
    userId: row.user_id,
    phone: row.phone ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    delta,
    reason: row.reason,
    balanceAfter: num(row.balance_after),
    amountKzt,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const USERS_CSV_HEADER = [
  'id',
  'phone',
  'first_name',
  'last_name',
  'email',
  'paid_kzt',
  'refunded_kzt',
  'balance_credits',
  'credited_credits',
  'spent_credits',
  'login_count',
  'last_login',
  'last_login_lang',
  'created_at'
];

export function formatUsersCsv(users: AccountingUser[]): string {
  const rows = users.map((u) => [
    u.id,
    u.phone,
    u.firstName,
    u.lastName,
    u.email,
    u.paidKzt,
    u.refundedKzt,
    u.balance,
    u.credited,
    u.spent,
    u.loginCount,
    u.lastLogin ?? '',
    u.lastLoginLang ?? '',
    u.createdAt
  ]);
  return toCsv(USERS_CSV_HEADER, rows);
}

const LEDGER_CSV_HEADER = [
  'id',
  'user_id',
  'phone',
  'first_name',
  'last_name',
  'reason',
  'delta_credits',
  'amount_kzt',
  'balance_after_credits',
  'created_at'
];

export function formatLedgerCsv(entries: LedgerEntry[]): string {
  const rows = entries.map((e) => [
    e.id,
    e.userId,
    e.phone,
    e.firstName,
    e.lastName,
    e.reason,
    e.delta,
    e.amountKzt ?? '',
    e.balanceAfter,
    e.createdAt
  ]);
  return toCsv(LEDGER_CSV_HEADER, rows);
}

const LOGINS_CSV_HEADER = [
  'created_at',
  'type',
  'user_id',
  'phone',
  'first_name',
  'last_name',
  'provider',
  'ip',
  'country',
  'city',
  'region',
  'timezone',
  'isp',
  'os',
  'browser',
  'device',
  'language'
];

export function formatLoginsCsv(entries: LoginEntry[]): string {
  const rows = entries.map((e) => [
    e.createdAt,
    e.type,
    e.userId,
    e.phone,
    e.firstName,
    e.lastName,
    e.provider ?? '',
    e.ip ?? '',
    e.country ?? '',
    e.city ?? '',
    e.region ?? '',
    e.timezone ?? '',
    e.isp ?? '',
    e.os ?? '',
    e.browser ?? '',
    e.device ?? '',
    e.lang ?? ''
  ]);
  return toCsv(LOGINS_CSV_HEADER, rows);
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((cols) => cols.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string | number): string {
  // 数值列(delta 可为负、balance 等)原样输出,避免把 -5 变成文本 '-5。
  if (typeof value === 'number') return String(value);
  let str = String(value ?? '');
  // 防 Excel 公式注入:用户可控文本(姓名/邮箱/手机号等)若以 = + - @ 开头,Excel 会当公式执行。
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
