import type { AuthStore } from './auth-store';
import type { SmsSender } from './sms';
import { hashPassword, verifyPassword } from './password';
import { signSession } from './session';
import { generateOtpCode, hashOtp, normalizePhone, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from './otp';
import { rateLimit } from './rate-limit';
import { toPublicUser, type OtpPurpose, type PublicUser } from './types';

// 限流参数(每实例计数,见 rate-limit.ts 说明)
const RATE_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX = 8; // 10 分钟内每号码最多 8 次登录尝试
const OTP_REQUEST_MAX = 5; // 10 分钟内每号码最多 5 次请求验证码
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 两次发码间隔 ≥ 60s
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 20;

export type AuthErrorCode =
  | 'NUMBER_EXISTS' // 注册:号码已存在
  | 'NUMBER_NOT_EXIST' // 登录/找回:号码不存在
  | 'WRONG_PASSWORD'
  | 'INVALID_CODE'
  | 'CODE_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'TOO_MANY_REQUESTS' // 限流/冷却
  | 'EMAIL_EXISTS'
  | 'SERVER_ERROR' // 上游(Marketplace)5xx 或网络/解析失败,与"验证码错误"区分
  | 'INVALID_INPUT';

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthErrorCode };

export function authErrorStatus(code: AuthErrorCode): number {
  switch (code) {
    case 'NUMBER_EXISTS':
    case 'EMAIL_EXISTS':
      return 409;
    case 'NUMBER_NOT_EXIST':
      return 404;
    case 'WRONG_PASSWORD':
      return 401;
    case 'TOO_MANY_REQUESTS':
      return 429;
    case 'SERVER_ERROR':
      return 502;
    default:
      return 400;
  }
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

export interface AuthServiceDependencies {
  store: AuthStore;
  sms: SmsSender;
  sessionSecret: string;
  // sandbox:为 true 时把验证码随响应回传(联调用),接真实短信后置 false
  exposeOtp: boolean;
}

export function createAuthService({ store, sms, sessionSecret, exposeOtp }: AuthServiceDependencies) {
  async function issueSession(uid: string) {
    return signSession(uid, sessionSecret, SESSION_TTL_SECONDS);
  }

  // 校验 OTP 是否有效(不删除,供两步流程的中间「verify」与最终提交各调一次)
  async function checkOtp(phone: string, purpose: OtpPurpose, code: string): Promise<AuthResult<true>> {
    const record = await store.getOtp(phone, purpose);
    if (!record) return { ok: false, error: 'INVALID_CODE' };
    if (new Date(record.expiresAt).getTime() < Date.now()) return { ok: false, error: 'CODE_EXPIRED' };
    if (record.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: 'TOO_MANY_ATTEMPTS' };
    const match = (await hashOtp(code)) === record.codeHash;
    if (!match) {
      await store.incrementOtpAttempts(phone, purpose);
      return { ok: false, error: 'INVALID_CODE' };
    }
    return { ok: true, data: true };
  }

  return {
    async requestOtp(rawPhone: string, purpose: OtpPurpose): Promise<AuthResult<{ debugCode?: string }>> {
      const phone = normalizePhone(rawPhone);
      if (phone.length < 8) return { ok: false, error: 'INVALID_INPUT' };

      // 限流 + 60s 重发冷却(防刷验证码 / 真实短信成本)
      if (!rateLimit(`otp:${phone}`, OTP_REQUEST_MAX, RATE_WINDOW_MS, Date.now()).ok) {
        return { ok: false, error: 'TOO_MANY_REQUESTS' };
      }
      const prev = await store.getOtp(phone, purpose);
      if (prev && Date.now() - new Date(prev.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
        return { ok: false, error: 'TOO_MANY_REQUESTS' };
      }

      const existing = await store.getUserByPhone(phone);
      if (purpose === 'register' && existing) return { ok: false, error: 'NUMBER_EXISTS' };
      if (purpose === 'recover' && !existing) return { ok: false, error: 'NUMBER_NOT_EXIST' };

      const code = generateOtpCode();
      await store.saveOtp({
        phone,
        purpose,
        codeHash: await hashOtp(code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
        attempts: 0,
        createdAt: new Date().toISOString()
      });
      await sms.send(phone, code);
      return { ok: true, data: exposeOtp ? { debugCode: code } : {} };
    },

    async verifyOtp(rawPhone: string, purpose: OtpPurpose, code: string): Promise<AuthResult<true>> {
      return checkOtp(normalizePhone(rawPhone), purpose, code);
    },

    async register(input: {
      phone: string;
      code: string;
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }): Promise<AuthResult<{ user: PublicUser; token: string }>> {
      const phone = normalizePhone(input.phone);
      if (!input.firstName.trim() || !input.email.trim() || !isValidPassword(input.password)) {
        return { ok: false, error: 'INVALID_INPUT' };
      }
      const check = await checkOtp(phone, 'register', input.code);
      if (!check.ok) return check;
      if (await store.getUserByPhone(phone)) return { ok: false, error: 'NUMBER_EXISTS' };
      if (await store.getUserByEmail(input.email)) return { ok: false, error: 'EMAIL_EXISTS' };

      const now = new Date().toISOString();
      const user = await store.createUser({
        id: `usr_${crypto.randomUUID()}`,
        phone,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        passwordHash: await hashPassword(input.password),
        balance: 0,
        createdAt: now,
        updatedAt: now
      });
      await store.deleteOtp(phone, 'register');
      return { ok: true, data: { user: toPublicUser(user), token: await issueSession(user.id) } };
    },

    async login(rawPhone: string, password: string): Promise<AuthResult<{ user: PublicUser; token: string }>> {
      const phone = normalizePhone(rawPhone);
      // 限流:防暴力撞密码
      if (!rateLimit(`login:${phone}`, LOGIN_MAX, RATE_WINDOW_MS, Date.now()).ok) {
        return { ok: false, error: 'TOO_MANY_REQUESTS' };
      }
      const user = await store.getUserByPhone(phone);
      if (!user) return { ok: false, error: 'NUMBER_NOT_EXIST' };
      if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: 'WRONG_PASSWORD' };
      return { ok: true, data: { user: toPublicUser(user), token: await issueSession(user.id) } };
    },

    async setNewPassword(input: { phone: string; code: string; password: string }): Promise<AuthResult<{ user: PublicUser; token: string }>> {
      const phone = normalizePhone(input.phone);
      if (!isValidPassword(input.password)) return { ok: false, error: 'INVALID_INPUT' };
      const check = await checkOtp(phone, 'recover', input.code);
      if (!check.ok) return check;
      const user = await store.getUserByPhone(phone);
      if (!user) return { ok: false, error: 'NUMBER_NOT_EXIST' };
      await store.updatePassword(user.id, await hashPassword(input.password));
      await store.deleteOtp(phone, 'recover');
      return { ok: true, data: { user: toPublicUser(user), token: await issueSession(user.id) } };
    },

    async me(uid: string): Promise<PublicUser | null> {
      const user = await store.getUserById(uid);
      return user ? toPublicUser(user) : null;
    },

    // 按手机号查用户(后台赠送额度用):传入原始输入,内部归一化。
    async getUserByPhone(rawPhone: string): Promise<PublicUser | null> {
      const user = await store.getUserByPhone(normalizePhone(rawPhone));
      return user ? toPublicUser(user) : null;
    },

    async getWallet(uid: string): Promise<{ balance: number } | null> {
      const user = await store.getUserById(uid);
      return user ? { balance: user.balance } : null;
    },

    // mock 充值(阶段 3 接真实支付后,由支付回调调用此逻辑加余额)
    async topup(uid: string, amount: number): Promise<{ balance: number } | null> {
      if (!Number.isFinite(amount) || amount <= 0) return null;
      const balance = await store.adjustBalance(uid, Math.trunc(amount), 'topup');
      return balance === null ? null : { balance };
    },

    // 退费(生成失败时退还),ledger reason=refund 区别于充值
    async refund(uid: string, amount: number): Promise<void> {
      const value = Math.trunc(amount);
      if (value > 0) await store.adjustBalance(uid, value, 'refund');
    },

    // 扣费:余额不足返回 {ok:false}
    async deduct(uid: string, amount: number, reason: string): Promise<{ ok: boolean; balance?: number }> {
      const cost = Math.trunc(amount);
      if (cost <= 0) return { ok: true };
      const balance = await store.adjustBalance(uid, -cost, reason);
      if (balance === null) return { ok: false };
      return { ok: true, balance };
    },

    // 充值到账(幂等):按 reference 去重,防同一笔支付重复加币。支付回调/状态轮询确认已付后调用。
    async creditOnce(
      uid: string,
      amount: number,
      reference: string,
      reason = 'topup',
      amountKzt?: number | null
    ): Promise<{ credited: boolean; balance: number } | null> {
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return store.creditOnce(uid, Math.trunc(amount), reference, reason, amountKzt);
    }
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
}
