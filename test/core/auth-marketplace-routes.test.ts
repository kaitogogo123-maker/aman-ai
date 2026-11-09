import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as loginPOST } from '@/app/api/v1/auth/login/route';
import { POST as logoutPOST } from '@/app/api/v1/auth/logout/route';
import { GET as meGET } from '@/app/api/v1/auth/me/route';
import { POST as recoverPOST } from '@/app/api/v1/auth/recover/route';
import { POST as registerPOST } from '@/app/api/v1/auth/register/route';
import { POST as requestOtpPOST } from '@/app/api/v1/auth/request-otp/route';
import { POST as verifyOtpPOST } from '@/app/api/v1/auth/verify-otp/route';

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function userFromMe(setCookie: string | null) {
  const sessionCookie = setCookie?.split(';')[0] ?? '';
  const response = await meGET(
    new NextRequest('http://localhost/api/v1/auth/me', {
      headers: {
        cookie: sessionCookie
      }
    })
  );
  return response.json() as Promise<{ user: { phone: string; firstName: string } | null }>;
}

describe('marketplace auth routes', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'marketplace';
    process.env.MOCK_MODE = 'true';
    process.env.AUTH_SECRET = 'marketplace-route-test-secret';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AUTH_PROVIDER;
    delete process.env.MOCK_MODE;
    delete process.env.AUTH_SECRET;
  });

  it('logs in through Marketplace and keeps /me backed by the local session cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            accessToken: 'access_login_route',
            expiresIn: 3600,
            refreshToken: 'refresh_login_route',
            refreshExpiresIn: 2592000,
            message: 'success'
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            id: 'customer_login_route',
            phone: '+77009050988',
            fullName: 'Route User'
          })
        )
    );

    const response = await loginPOST(jsonRequest('/api/v1/auth/login', { phone: '77009050988', password: 'pass1234' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      user: {
        phone: '77009050988',
        firstName: 'Route'
      }
    });
    await expect(userFromMe(response.headers.get('set-cookie'))).resolves.toMatchObject({
      user: {
        phone: '77009050988',
        firstName: 'Route'
      }
    });
  });

  it('proxies sign-up and recover OTP flows to Marketplace', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            accessToken: null,
            expiresIn: 0,
            refreshToken: null,
            refreshExpiresIn: 0,
            message: 'smsCode отправлен'
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            accessToken: null,
            expiresIn: 0,
            refreshToken: null,
            refreshExpiresIn: 0,
            message: 'Смс код верный'
          })
        )
        .mockResolvedValueOnce(Response.json({ first: 'smsCode отправлен', second: 0 }))
        .mockResolvedValueOnce(Response.json({ first: 'Смс код верный', second: 0 }))
    );

    await expect(
      (await requestOtpPOST(jsonRequest('/api/v1/auth/request-otp', { phone: '77009050988', purpose: 'register' }))).json()
    ).resolves.toEqual({ ok: true });
    await expect(
      (await verifyOtpPOST(jsonRequest('/api/v1/auth/verify-otp', { phone: '77009050988', purpose: 'register', code: '4821' }))).json()
    ).resolves.toEqual({ ok: true });
    await expect(
      (await requestOtpPOST(jsonRequest('/api/v1/auth/request-otp', { phone: '77009050988', purpose: 'recover' }))).json()
    ).resolves.toEqual({ ok: true });
    await expect(
      (await verifyOtpPOST(jsonRequest('/api/v1/auth/verify-otp', { phone: '77009050988', purpose: 'recover', code: '4821' }))).json()
    ).resolves.toEqual({ ok: true });
  });

  it('registers and recovers through Marketplace while issuing the local session cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            accessToken: 'access_register_route',
            expiresIn: 3600,
            refreshToken: 'refresh_register_route',
            refreshExpiresIn: 2592000,
            message: 'customer создан или обновлен'
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            id: 'customer_register_route',
            phone: '+77009050989',
            fullName: 'Register User'
          })
        )
        .mockResolvedValueOnce(Response.json({ first: 'Пароль успешно изменен', second: 0 }))
        .mockResolvedValueOnce(
          Response.json({
            accessToken: 'access_recover_route',
            expiresIn: 3600,
            refreshToken: 'refresh_recover_route',
            refreshExpiresIn: 2592000,
            message: 'success'
          })
        )
        .mockResolvedValueOnce(
          Response.json({
            id: 'customer_recover_route',
            phone: '+77009050990',
            fullName: 'Recover User'
          })
        )
    );

    const registerResponse = await registerPOST(
      jsonRequest('/api/v1/auth/register', {
        phone: '77009050989',
        code: '4821',
        firstName: 'Register',
        lastName: 'User',
        email: 'register@example.com',
        password: 'pass1234'
      })
    );
    expect(registerResponse.status).toBe(200);
    await expect(userFromMe(registerResponse.headers.get('set-cookie'))).resolves.toMatchObject({
      user: {
        phone: '77009050989',
        firstName: 'Register'
      }
    });

    const recoverResponse = await recoverPOST(
      jsonRequest('/api/v1/auth/recover', {
        phone: '77009050990',
        code: '4821',
        password: 'newpass1'
      })
    );
    expect(recoverResponse.status).toBe(200);
    await expect(userFromMe(recoverResponse.headers.get('set-cookie'))).resolves.toMatchObject({
      user: {
        phone: '77009050990',
        firstName: 'Recover'
      }
    });
  });

  it('clears local and Marketplace auth cookies on logout', async () => {
    const response = await logoutPOST();
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(setCookie).toContain('aman_session=');
    expect(setCookie).toContain('aman_market_access=');
    expect(setCookie).toContain('aman_market_refresh=');
  });
});
