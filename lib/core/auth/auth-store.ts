import type { OtpPurpose, OtpRecord, User } from './types';

export interface AuthStore {
  getUserByPhone(phone: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  // 调整余额(delta 可负=扣费)。返回新余额;用户不存在或扣费后会变负 → null(余额不足)。
  adjustBalance(userId: string, delta: number, reason: string): Promise<number | null>;
  // 幂等入账:按 reference 去重(ledger id = led_<reference>),防同一笔支付重复加币。
  // credited=false 表示该 reference 已入过账(本次跳过);用户不存在返回 null。
  creditOnce(
    userId: string,
    amount: number,
    reference: string,
    reason: string,
    amountKzt?: number | null // 实付 ₸ 快照(付费入账才有),落库防日后调价重算历史
  ): Promise<{ credited: boolean; balance: number } | null>;

  // OTP:按 (phone, purpose) 唯一,saveOtp 覆盖旧码
  saveOtp(record: OtpRecord): Promise<void>;
  getOtp(phone: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  incrementOtpAttempts(phone: string, purpose: OtpPurpose): Promise<void>;
  deleteOtp(phone: string, purpose: OtpPurpose): Promise<void>;
}

interface MemoryState {
  users: Map<string, User>; // key = userId
  otps: Map<string, OtpRecord>; // key = `${phone}:${purpose}`
  creditRefs: Set<string>; // 已入账的 reference,creditOnce 幂等去重
}

// 用 globalThis 单例,保证同一 worker 实例内跨请求/HMR 持久(无 DB 时的 sandbox 用)
function memoryState(): MemoryState {
  const g = globalThis as typeof globalThis & { __amanAuthMemory?: MemoryState };
  g.__amanAuthMemory ??= { users: new Map(), otps: new Map(), creditRefs: new Set() };
  return g.__amanAuthMemory;
}

const otpKey = (phone: string, purpose: OtpPurpose) => `${phone}:${purpose}`;

export function createMemoryAuthStore(): AuthStore {
  const state = memoryState();

  return {
    async getUserByPhone(phone) {
      return [...state.users.values()].find((u) => u.phone === phone) ?? null;
    },
    async getUserById(id) {
      return state.users.get(id) ?? null;
    },
    async getUserByEmail(email) {
      const lower = email.trim().toLowerCase();
      return [...state.users.values()].find((u) => u.email.toLowerCase() === lower) ?? null;
    },
    async createUser(user) {
      state.users.set(user.id, user);
      return user;
    },
    async updatePassword(userId, passwordHash) {
      const user = state.users.get(userId);
      if (user) state.users.set(userId, { ...user, passwordHash, updatedAt: new Date().toISOString() });
    },
    async adjustBalance(userId, delta) {
      const user = state.users.get(userId);
      if (!user) return null;
      const next = user.balance + delta;
      if (next < 0) return null;
      state.users.set(userId, { ...user, balance: next, updatedAt: new Date().toISOString() });
      return next;
    },
    async creditOnce(userId, amount, reference) {
      const user = state.users.get(userId);
      if (!user) return null;
      if (state.creditRefs.has(reference)) return { credited: false, balance: user.balance };
      state.creditRefs.add(reference);
      const next = user.balance + Math.trunc(amount);
      state.users.set(userId, { ...user, balance: next, updatedAt: new Date().toISOString() });
      return { credited: true, balance: next };
    },
    async saveOtp(record) {
      state.otps.set(otpKey(record.phone, record.purpose), record);
    },
    async getOtp(phone, purpose) {
      return state.otps.get(otpKey(phone, purpose)) ?? null;
    },
    async incrementOtpAttempts(phone, purpose) {
      const rec = state.otps.get(otpKey(phone, purpose));
      if (rec) state.otps.set(otpKey(phone, purpose), { ...rec, attempts: rec.attempts + 1 });
    },
    async deleteOtp(phone, purpose) {
      state.otps.delete(otpKey(phone, purpose));
    }
  };
}
