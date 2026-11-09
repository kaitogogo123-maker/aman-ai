import { describe, expect, it } from 'vitest';
import { createAuthService } from '@/lib/core/auth/service';
import { createMemoryAuthStore } from '@/lib/core/auth/auth-store';
import { createSandboxSmsSender } from '@/lib/core/auth/sms';

// 共享内存 store(globalThis 单例),各用例用唯一手机号避免串扰
const s = createAuthService({
  store: createMemoryAuthStore(),
  sms: createSandboxSmsSender(),
  sessionSecret: 'unit-secret',
  exposeOtp: true
});

async function debugCode(phone: string, purpose: 'register' | 'recover') {
  const r = await s.requestOtp(phone, purpose);
  if (!r.ok) throw new Error(`requestOtp failed: ${r.error}`);
  return r.data.debugCode as string;
}

describe('auth/service', () => {
  it('register → me → login flow', async () => {
    const phone = '77000000010';
    const code = await debugCode(phone, 'register');
    const reg = await s.register({ phone, code, firstName: 'Aina', lastName: 'B', email: 'a10@t.com', password: 'qwert123' });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    expect(reg.data.user.phone).toBe(phone);
    expect(reg.data.token.length).toBeGreaterThan(10);
    expect((await s.me(reg.data.user.id))?.email).toBe('a10@t.com');

    const bad = await s.login(phone, 'nope');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('WRONG_PASSWORD');
    expect((await s.login(phone, 'qwert123')).ok).toBe(true);
  });

  it('requestOtp on existing number → NUMBER_EXISTS', async () => {
    const phone = '77000000011';
    const code = await debugCode(phone, 'register');
    await s.register({ phone, code, firstName: 'A', lastName: 'B', email: 'a11@t.com', password: 'qwert123' });
    const again = await s.requestOtp(phone, 'register');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('NUMBER_EXISTS');
  });

  it('recover on non-existent number → NUMBER_NOT_EXIST', async () => {
    const r = await s.requestOtp('77000000099', 'recover');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('NUMBER_NOT_EXIST');
  });

  it('wrong code → INVALID_CODE', async () => {
    const phone = '77000000012';
    const code = await debugCode(phone, 'register');
    const wrong = String((Number(code) + 1) % 10000).padStart(4, '0');
    const v = await s.verifyOtp(phone, 'register', wrong);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toBe('INVALID_CODE');
  });

  it('resend within cooldown → TOO_MANY_REQUESTS', async () => {
    const phone = '77000000013';
    expect((await s.requestOtp(phone, 'register')).ok).toBe(true);
    const second = await s.requestOtp(phone, 'register');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('TOO_MANY_REQUESTS');
  });

  it('wallet: deduct insufficient, then topup then deduct', async () => {
    const phone = '77000000014';
    const code = await debugCode(phone, 'register');
    const reg = await s.register({ phone, code, firstName: 'A', lastName: 'B', email: 'a14@t.com', password: 'qwert123' });
    if (!reg.ok) throw new Error('register failed');
    const uid = reg.data.user.id;
    expect((await s.deduct(uid, 500, 'gen')).ok).toBe(false);
    expect((await s.topup(uid, 1000))?.balance).toBe(1000);
    const d = await s.deduct(uid, 500, 'gen');
    expect(d.ok).toBe(true);
    expect(d.balance).toBe(500);
  });

  it('accepts 4-20 character passwords and rejects longer passwords', async () => {
    const phone = '77000000015';
    const code = await debugCode(phone, 'register');
    const short = await s.register({ phone, code, firstName: 'A', lastName: 'B', email: 'a15@t.com', password: '1234' });
    expect(short.ok).toBe(true);

    const longPhone = '77000000016';
    const longCode = await debugCode(longPhone, 'register');
    const tooLong = await s.register({
      phone: longPhone,
      code: longCode,
      firstName: 'A',
      lastName: 'B',
      email: 'a16@t.com',
      password: '123456789012345678901'
    });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error).toBe('INVALID_INPUT');
  });

  it('creditOnce is idempotent per reference (no double credit)', async () => {
    const phone = '77000000020';
    const code = await debugCode(phone, 'register');
    const reg = await s.register({ phone, code, firstName: 'C', lastName: 'D', email: 'a20@t.com', password: 'qwert123' });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    const uid = reg.data.user.id;
    const ref = 'order_9001';

    const first = await s.creditOnce(uid, 15000, ref);
    expect(first).toEqual({ credited: true, balance: 15000 });

    // 同一 reference 再调:不重复加币
    const second = await s.creditOnce(uid, 15000, ref);
    expect(second).toEqual({ credited: false, balance: 15000 });

    // 不同 reference:正常加币
    const third = await s.creditOnce(uid, 5000, 'order_9002');
    expect(third).toEqual({ credited: true, balance: 20000 });

    expect((await s.getWallet(uid))?.balance).toBe(20000);
  });

  it('creditOnce rejects non-positive amount and missing user', async () => {
    expect(await s.creditOnce('usr_nope', 1000, 'order_x')).toBeNull();
    const phone = '77000000021';
    const code = await debugCode(phone, 'register');
    const reg = await s.register({ phone, code, firstName: 'E', lastName: 'F', email: 'a21@t.com', password: 'qwert123' });
    if (!reg.ok) return;
    expect(await s.creditOnce(reg.data.user.id, 0, 'order_zero')).toBeNull();
  });
});
