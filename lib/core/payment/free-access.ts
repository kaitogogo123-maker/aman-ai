import { normalizePhone } from '@/lib/core/auth/otp';

// 免支付白名单(测试/演示账号):名单内手机号生图不扣额度、不拦截。
// 77000000099 = 客户指定的测试演示号(marketplace customer id 360)。
const FREE_ACCESS_PHONES = new Set(['77000000099']);

export function isPaymentWhitelisted(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return FREE_ACCESS_PHONES.has(normalizePhone(phone));
}

// 免支付白名单手机号列表(= 测试/演示账号)。后台维护工具用它界定"只能动测试号"。
export function getFreeAccessPhones(): string[] {
  return [...FREE_ACCESS_PHONES];
}
