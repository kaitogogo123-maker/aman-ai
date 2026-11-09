import { getRuntimeEnv } from '@/lib/config/env';
import { normalizePhone } from './otp';
import type { AuthErrorCode, AuthResult } from './service';
import type { PublicUser } from './types';

interface JwtResponse {
  accessToken: string | null;
  expiresIn: number;
  refreshToken: string | null;
  refreshExpiresIn: number;
  message: string | null;
}

interface ForgotPasswordResponse {
  first: string | null;
  second: number;
}

// 注册第一/二步后端返回 Pair.of(message, 0L);不同序列化下文案可能落在 message 或 first。
interface SmsStepResponse {
  message?: string | null;
  first?: string | null;
}

type Fetcher = typeof fetch;

export interface MarketplaceSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface MarketplaceAuthClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
}

export function createMarketplaceAuthClient(options: MarketplaceAuthClientOptions = {}) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? getRuntimeEnv().MARKETPLACE_API_BASE_URL);
  const fetcher = options.fetcher ?? fetch;

  // 返回 ok=false 表示上游 5xx / 网络失败 / 响应非 JSON;调用方据此返回 SERVER_ERROR,
  // 避免把上游故障当成业务错误(如"验证码错误")误导用户。
  async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; body: T }> {
    try {
      const response = await fetcher(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const parsed = (await response.json().catch(() => null)) as T | null;
      // Marketplace 业务错误恒为 HTTP 200(靠 body 文案判断);非 2xx 一律视为上游故障。
      if (!response.ok || parsed === null) {
        return { ok: false, body: (parsed ?? {}) as T };
      }
      return { ok: true, body: parsed };
    } catch {
      return { ok: false, body: {} as T };
    }
  }

  async function profileInfo(accessToken: string, fallbackPhone: string): Promise<PublicUser> {
    // token 已拿到,profile 抖动不应让登录失败:任何异常都回退到按手机号构造的最小用户。
    try {
      const response = await fetcher(`${baseUrl}/profile/info`, {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });
      const profile = await response.json().catch(() => ({}));
      return profileToPublicUser(profile, fallbackPhone);
    } catch {
      return profileToPublicUser({}, fallbackPhone);
    }
  }

  async function completeSession(auth: JwtResponse, fallbackPhone: string): Promise<AuthResult<MarketplaceSession>> {
    if (!auth.accessToken || !auth.refreshToken) {
      return { ok: false, error: mapJwtMessage(auth.message) };
    }
    const user = await profileInfo(auth.accessToken, fallbackPhone);
    return {
      ok: true,
      data: {
        user,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken
      }
    };
  }

  async function signIn(phone: string, password: string): Promise<AuthResult<MarketplaceSession>> {
    const normalizedPhone = toMarketplacePhone(phone);
    const auth = await post<JwtResponse>('/authmarket/sign-in', {
      phone: normalizedPhone,
      password
    });
    if (!auth.ok) return { ok: false, error: 'SERVER_ERROR' };
    return completeSession(auth.body, normalizedPhone);
  }

  return {
    signIn,

    async requestSignUpSms(phone: string): Promise<AuthResult<true>> {
      // 文档第一步:仅发 phone,后端据此发送短信验证码。
      const response = await post<SmsStepResponse>('/authmarket/sign-up', {
        phone: toMarketplacePhone(phone)
      });
      if (!response.ok) return { ok: false, error: 'SERVER_ERROR' };
      return smsStepOk(response.body, ['smsCode отправлен']);
    },

    async verifySignUpSms(phone: string, smsCode: string): Promise<AuthResult<true>> {
      // 文档第二步:发 phone + smsCode,后端校验验证码。
      const response = await post<SmsStepResponse>('/authmarket/sign-up', {
        phone: toMarketplacePhone(phone),
        smsCode
      });
      if (!response.ok) return { ok: false, error: 'SERVER_ERROR' };
      return smsStepOk(response.body, ['Смс код верный']);
    },

    async completeSignUp(input: {
      phone: string;
      code: string;
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }): Promise<AuthResult<MarketplaceSession>> {
      const normalizedPhone = toMarketplacePhone(input.phone);
      const fullName = [input.firstName.trim(), input.lastName.trim()].filter(Boolean).join(' ');
      // 字段集与取值严格对齐后端确认模板(Куаныш 2026-06-19):去掉多余的
      // fromWho/pushToken/presentId;filialId 必须留空——后端没有 id=1 的网点,发 1 会报错;
      // cityId=10 即 Алматы,cityName/regionName 随之固定。仅 fullName/email/password/
      // phone/smsCode 为用户数据,其余照模板。
      const auth = await post<JwtResponse>('/authmarket/sign-up', {
        phone: normalizedPhone,
        fullName,
        lastName: '',
        password: input.password,
        email: input.email.trim(),
        cityId: 10,
        cityName: 'Алматы',
        filialId: '',
        pushStatus: '',
        regionName: 'Алматинская',
        smsCode: input.code,
        username: ''
      });
      if (!auth.ok) return { ok: false, error: 'SERVER_ERROR' };
      return completeSession(auth.body, normalizedPhone);
    },

    async requestPasswordResetSms(phone: string): Promise<AuthResult<true>> {
      const response = await post<ForgotPasswordResponse>('/authmarket/forgot-password', {
        phone: toMarketplacePhone(phone),
        smsCode: '',
        password: ''
      });
      if (!response.ok) return { ok: false, error: 'SERVER_ERROR' };
      return forgotMessageOk(response.body.first, ['smsCode отправлен']);
    },

    async verifyPasswordResetSms(phone: string, smsCode: string): Promise<AuthResult<true>> {
      const response = await post<ForgotPasswordResponse>('/authmarket/forgot-password', {
        phone: toMarketplacePhone(phone),
        smsCode,
        password: ''
      });
      if (!response.ok) return { ok: false, error: 'SERVER_ERROR' };
      return forgotMessageOk(response.body.first, ['Смс код верный']);
    },

    async resetPasswordAndSignIn(phone: string, smsCode: string, password: string): Promise<AuthResult<MarketplaceSession>> {
      const normalizedPhone = toMarketplacePhone(phone);
      const response = await post<ForgotPasswordResponse>('/authmarket/forgot-password', {
        phone: normalizedPhone,
        smsCode,
        password
      });
      if (!response.ok) return { ok: false, error: 'SERVER_ERROR' };
      const reset = forgotMessageOk(response.body.first, ['Пароль успешно изменен']);
      if (!reset.ok) return reset;
      return signIn(normalizedPhone, password);
    },

    async refresh(refreshToken: string): Promise<AuthResult<{ accessToken: string; refreshToken: string }>> {
      const response = await post<JwtResponse>('/authmarket/refresh', { refreshToken });
      if (!response.ok) return { ok: false, error: 'SERVER_ERROR' };
      const body = response.body;
      if (!body.accessToken || !body.refreshToken) {
        return { ok: false, error: mapJwtMessage(body.message) };
      }
      return {
        ok: true,
        data: {
          accessToken: body.accessToken,
          refreshToken: body.refreshToken
        }
      };
    }
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function toMarketplacePhone(phone: string): string {
  // 发后端的手机号用纯 11 位数字(77000000099),不带 + 前缀:后端会按字面截掉 "+7",
  // 导致丢国家码变成 10 位(707…)而报错;其前端也只发纯数字。sign-in 实测带不带 + 都通,
  // 去掉 + 与其前端对齐且消除歧义。
  const normalized = normalizePhone(phone);
  return normalized || phone.trim();
}

function mapJwtMessage(message: string | null): AuthErrorCode {
  if (message?.includes('Неверно')) return 'WRONG_PASSWORD';
  if (message?.includes('существует')) return 'NUMBER_EXISTS';
  if (message?.includes('Смс код неверный')) return 'INVALID_CODE';
  return 'INVALID_INPUT';
}

function mapForgotMessage(message: string | null): AuthErrorCode {
  if (message?.includes('Клиент отсутствует')) return 'NUMBER_NOT_EXIST';
  if (message?.includes('Смс код неверный')) return 'INVALID_CODE';
  return 'INVALID_INPUT';
}

// Pair.of 在 forgot-password 序列化为 {first,second},sign-up 文档同样用 Pair.of;
// message 与 first 都读,避免后端把成功文案放在 first 时被误判为失败、导致不展示验证码输入框。
function smsStepOk(body: SmsStepResponse, successMessages: string[]): AuthResult<true> {
  const text = body.message ?? body.first ?? null;
  if (text && successMessages.some((success) => text.includes(success))) {
    return { ok: true, data: true };
  }
  return { ok: false, error: mapJwtMessage(text) };
}

function forgotMessageOk(message: string | null, successMessages: string[]): AuthResult<true> {
  if (message && successMessages.some((success) => message.includes(success))) {
    return { ok: true, data: true };
  }
  return { ok: false, error: mapForgotMessage(message) };
}

function profileToPublicUser(profile: unknown, fallbackPhone: string): PublicUser {
  const data = isRecord(profile) ? profile : {};
  const rawId = readFirst(data, ['id', 'customerId', 'customer_id', 'uid']);
  const rawPhone = readFirst(data, ['phone', 'phoneNumber', 'phone_number']);
  const fullName = stringValue(readFirst(data, ['fullName', 'fullname', 'name']));
  const firstName = stringValue(readFirst(data, ['firstName', 'first_name'])) || splitName(fullName)[0] || 'User';
  const lastName = stringValue(readFirst(data, ['lastName', 'last_name'])) || splitName(fullName).slice(1).join(' ');
  const email = stringValue(readFirst(data, ['email']));
  const balance = numberValue(readFirst(data, ['balance', 'wallet', 'amount'])) ?? 0;

  return {
    id: stringValue(rawId) || normalizePhone(fallbackPhone) || 'marketplace-user',
    phone: normalizePhone(stringValue(rawPhone) || fallbackPhone),
    firstName,
    lastName,
    email,
    balance
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readFirst(data: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) return data[key];
  }
  return undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function numberValue(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function splitName(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}
