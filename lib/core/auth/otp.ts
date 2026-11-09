// OTP 验证码:4 位数字(对齐设计稿「0 4 5 1」),用 crypto 安全随机。
// 仅存哈希(SHA-256),校验时比对哈希。
const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;

export { OTP_TTL_SECONDS, OTP_MAX_ATTEMPTS };

export function generateOtpCode(): string {
  const buf = crypto.getRandomValues(new Uint32Array(1));
  return String(buf[0] % 10000).padStart(4, '0');
}

export async function hashOtp(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 手机号规范化:去掉 +、空格、括号、连字符,只留数字
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}
