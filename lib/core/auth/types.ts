// 鉴权领域类型。手机号统一存「纯数字带国家码」(如 77001234567),不含 + 和分隔符。
export type OtpPurpose = 'register' | 'recover';

export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  // PBKDF2 编码串:pbkdf2$iterations$saltB64$hashB64
  passwordHash: string;
  // 钱包余额(整数,单位:坚戈 ₸),阶段 2 启用
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface OtpRecord {
  phone: string;
  purpose: OtpPurpose;
  // 仅存验证码哈希,不存明文
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

export interface SessionPayload {
  uid: string;
  // 过期时间(epoch 秒)
  exp: number;
}

// 对外安全用户视图(绝不下发 passwordHash)
export interface PublicUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  balance: number;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    balance: user.balance
  };
}
