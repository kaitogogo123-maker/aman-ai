import type { QueryClient } from '@/lib/core/generation/postgres-task-store';
import type { AuthStore } from './auth-store';
import type { OtpPurpose, OtpRecord, User } from './types';

const CREATE_USERS_SQL = `
  create table if not exists auth_users (
    id text primary key,
    phone text not null unique,
    first_name text not null,
    last_name text not null,
    email text not null,
    password_hash text not null,
    balance integer not null default 0,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )
`;

const CREATE_OTPS_SQL = `
  create table if not exists auth_otps (
    phone text not null,
    purpose text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    attempts integer not null default 0,
    created_at timestamptz not null,
    primary key (phone, purpose)
  )
`;

const CREATE_LEDGER_SQL = `
  create table if not exists credit_ledger (
    id text primary key,
    user_id text not null,
    delta integer not null,
    reason text not null,
    balance_after integer not null,
    amount_kzt integer,
    created_at timestamptz not null
  )
`;

// 已有库补列:入账时把实付 ₸ 快照落库(topup),避免日后调价后历史金额被重算。旧行 amount_kzt=null。
const ALTER_LEDGER_AMOUNT_SQL = `alter table credit_ledger add column if not exists amount_kzt integer`;

interface UserRow {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    passwordHash: row.password_hash,
    balance: Number(row.balance),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

interface OtpRow {
  phone: string;
  purpose: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  created_at: string;
}

// 惰性建表:表已存在则稳态零 DDL,每请求只跑真实查询。仅当查询报「表不存在」才建表+重试一次。
// (之前每个 API 请求都先主动跑 3 条 CREATE TABLE;低流量下 Cloudflare 频繁起新 isolate,
//  每个新 isolate 都重跑 3 条串行 Neon 往返 → request-otp 实测 ~3s。改惰性后只在首个全新 DB 触发。)
let schemaReady: Promise<void> | undefined;

function isUndefinedTable(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === '42P01' || /does not exist/i.test(err?.message ?? '');
}

async function ensureSchema(client: QueryClient): Promise<void> {
  schemaReady ??= (async () => {
    await client.query(CREATE_USERS_SQL);
    await client.query(CREATE_OTPS_SQL);
    await client.query(CREATE_LEDGER_SQL);
    await client.query(ALTER_LEDGER_AMOUNT_SQL); // 幂等补列(老库无 amount_kzt 时)
  })().catch((e) => {
    schemaReady = undefined; // 建表失败不毒化缓存,下次可重试
    throw e;
  });
  await schemaReady;
}

// 包装 client:查询若因表不存在而失败,则建表后重试一次(自愈,仅全新 DB 首次触发)
function withSchemaHeal(client: QueryClient): QueryClient {
  return {
    async query<T>(text: string, params: unknown[] = []): Promise<T[]> {
      try {
        return await client.query<T>(text, params);
      } catch (e) {
        if (!isUndefinedTable(e)) throw e;
        await ensureSchema(client);
        return client.query<T>(text, params);
      }
    }
  };
}

export function createPostgresAuthStore({ client: rawClient }: { client: QueryClient }): AuthStore {
  const client = withSchemaHeal(rawClient);

  return {
    async getUserByPhone(phone) {
      const rows = await client.query<UserRow>('select * from auth_users where phone = $1 limit 1', [phone]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },
    async getUserById(id) {
      const rows = await client.query<UserRow>('select * from auth_users where id = $1 limit 1', [id]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },
    async getUserByEmail(email) {
      const rows = await client.query<UserRow>('select * from auth_users where lower(email) = lower($1) limit 1', [email]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },
    async createUser(user) {
      await client.query(
        `insert into auth_users (id, phone, first_name, last_name, email, password_hash, balance, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.id, user.phone, user.firstName, user.lastName, user.email, user.passwordHash, user.balance, user.createdAt, user.updatedAt]
      );
      return user;
    },
    async updatePassword(userId, passwordHash) {
      await client.query('update auth_users set password_hash = $1, updated_at = $2 where id = $3', [
        passwordHash,
        new Date().toISOString(),
        userId
      ]);
    },
    async adjustBalance(userId, delta, reason) {
      // 原子:仅当扣费后不为负才更新(并发安全的余额校验)
      const rows = await client.query<{ balance: number }>(
        'update auth_users set balance = balance + $1, updated_at = $2 where id = $3 and balance + $1 >= 0 returning balance',
        [delta, new Date().toISOString(), userId]
      );
      if (!rows[0]) return null;
      const balance = Number(rows[0].balance);
      await client.query(
        'insert into credit_ledger (id, user_id, delta, reason, balance_after, created_at) values ($1,$2,$3,$4,$5,$6)',
        [`led_${crypto.randomUUID()}`, userId, delta, reason, balance, new Date().toISOString()]
      );
      return balance;
    },
    async creditOnce(userId, amount, reference, reason, amountKzt) {
      // 幂等:ledger id = led_<reference> 作主键去重。单条 CTE 原子完成:
      // 仅当 ledger 行是本次新插入(claim 非空)时才加余额,重复调用走 on conflict 跳过不加币。
      // balance_after 在插入时即按「当前余额+delta」写入(与 upd 同快照),无需事后回填。
      // amount_kzt=下单时实付 ₸ 快照(付费入账才有),日后调价不影响历史金额。
      const ledgerId = `led_${reference}`;
      const now = new Date().toISOString();
      const kzt = amountKzt == null ? null : Math.trunc(amountKzt);
      const rows = await client.query<{ balance: number | null; credited: boolean }>(
        `with claim as (
           insert into credit_ledger (id, user_id, delta, reason, balance_after, amount_kzt, created_at)
           select $1, $2, $3, $4,
                  (select balance from auth_users where id = $2) + $3, -- 变动后余额=当前余额+delta(与下方 upd 同快照)
                  $6, $5
           where exists (select 1 from auth_users where id = $2)
           on conflict (id) do nothing
           returning id
         ),
         upd as (
           update auth_users set balance = balance + $3, updated_at = $5
           where id = $2 and exists (select 1 from claim)
           returning balance
         )
         select coalesce((select balance from upd), (select balance from auth_users where id = $2)) as balance,
                exists (select 1 from claim) as credited`,
        [ledgerId, userId, Math.trunc(amount), reason, now, kzt]
      );
      const row = rows[0];
      if (!row || row.balance === null) return null;
      return { credited: Boolean(row.credited), balance: Number(row.balance) };
    },
    async saveOtp(record) {
      await client.query(
        `insert into auth_otps (phone, purpose, code_hash, expires_at, attempts, created_at)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (phone, purpose) do update set
           code_hash = excluded.code_hash,
           expires_at = excluded.expires_at,
           attempts = excluded.attempts,
           created_at = excluded.created_at`,
        [record.phone, record.purpose, record.codeHash, record.expiresAt, record.attempts, record.createdAt]
      );
    },
    async getOtp(phone, purpose) {
      const rows = await client.query<OtpRow>('select * from auth_otps where phone = $1 and purpose = $2 limit 1', [
        phone,
        purpose
      ]);
      const row = rows[0];
      if (!row) return null;
      return {
        phone: row.phone,
        purpose: row.purpose as OtpPurpose,
        codeHash: row.code_hash,
        expiresAt: new Date(row.expires_at).toISOString(),
        attempts: Number(row.attempts),
        createdAt: new Date(row.created_at).toISOString()
      } satisfies OtpRecord;
    },
    async incrementOtpAttempts(phone, purpose) {
      await client.query('update auth_otps set attempts = attempts + 1 where phone = $1 and purpose = $2', [
        phone,
        purpose
      ]);
    },
    async deleteOtp(phone, purpose) {
      await client.query('delete from auth_otps where phone = $1 and purpose = $2', [phone, purpose]);
    }
  };
}
