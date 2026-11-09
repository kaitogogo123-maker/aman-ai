import { describe, expect, it, vi } from 'vitest';
import { createMarketplaceAuthClient } from '@/lib/core/auth/marketplace-client';

describe('marketplace auth client', () => {
  it('posts sign-in requests to the aman.kz /api authmarket endpoint and loads profile info', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          accessToken: 'access_1',
          expiresIn: 3600,
          refreshToken: 'refresh_1',
          refreshExpiresIn: 2592000,
          message: 'success'
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 42,
          phone: '+77009050988',
          fullName: 'Aman User',
          email: 'user@example.com',
          balance: 1200
        })
      );
    const client = createMarketplaceAuthClient({ fetcher });

    const result = await client.signIn('77009050988', 'pass1234');

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://aman.kz/api/authmarket/sign-in',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phone: '77009050988', password: 'pass1234' })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://aman.kz/api/profile/info',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer access_1'
        })
      })
    );
    expect(result).toEqual({
      ok: true,
      data: {
        user: {
          id: '42',
          phone: '77009050988',
          firstName: 'Aman',
          lastName: 'User',
          email: 'user@example.com',
          balance: 1200
        },
        accessToken: 'access_1',
        refreshToken: 'refresh_1'
      }
    });
  });

  it('maps marketplace invalid credential messages to the existing auth error contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        accessToken: null,
        expiresIn: 0,
        refreshToken: null,
        refreshExpiresIn: 0,
        message: 'Неверно учетные данные'
      })
    );
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.signIn('+77009050988', 'bad')).resolves.toEqual({
      ok: false,
      error: 'WRONG_PASSWORD'
    });
  });

  it('supports the marketplace sign-up SMS, verification, and completion flow', async () => {
    const fetcher = vi
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
      .mockResolvedValueOnce(
        Response.json({
          accessToken: 'access_signup',
          expiresIn: 3600,
          refreshToken: 'refresh_signup',
          refreshExpiresIn: 2592000,
          message: 'customer создан или обновлен'
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'customer_7',
          phone: '+77009050988',
          firstName: 'Aman',
          lastName: 'User'
        })
      );
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.requestSignUpSms('77009050988')).resolves.toEqual({ ok: true, data: true });
    await expect(client.verifySignUpSms('77009050988', '4821')).resolves.toEqual({ ok: true, data: true });
    const completed = await client.completeSignUp({
      phone: '77009050988',
      code: '4821',
      firstName: 'Aman',
      lastName: 'User',
      email: 'user@example.com',
      password: 'pass1234'
    });

    expect(completed.ok).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://aman.kz/api/authmarket/sign-up',
      expect.objectContaining({
        body: JSON.stringify({ phone: '77009050988' })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://aman.kz/api/authmarket/sign-up',
      expect.objectContaining({
        body: JSON.stringify({ phone: '77009050988', smsCode: '4821' })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'https://aman.kz/api/authmarket/sign-up',
      expect.objectContaining({
        body: JSON.stringify({
          phone: '77009050988',
          fullName: 'Aman User',
          lastName: '',
          password: 'pass1234',
          email: 'user@example.com',
          cityId: 10,
          cityName: 'Алматы',
          filialId: '',
          pushStatus: '',
          regionName: 'Алматинская',
          smsCode: '4821',
          username: ''
        })
      })
    );
  });

  it('recognizes sign-up SMS success when the backend serializes Pair as {first}', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ first: 'smsCode отправлен', second: 0 }))
      .mockResolvedValueOnce(Response.json({ first: 'Смс код верный', second: 0 }));
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.requestSignUpSms('77009050988')).resolves.toEqual({ ok: true, data: true });
    await expect(client.verifySignUpSms('77009050988', '4821')).resolves.toEqual({ ok: true, data: true });
  });

  it('supports forgot-password verification and signs in after setting the new password', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ first: 'smsCode отправлен', second: 0 }))
      .mockResolvedValueOnce(Response.json({ first: 'Смс код верный', second: 0 }))
      .mockResolvedValueOnce(Response.json({ first: 'Пароль успешно изменен', second: 0 }))
      .mockResolvedValueOnce(
        Response.json({
          accessToken: 'access_reset',
          expiresIn: 3600,
          refreshToken: 'refresh_reset',
          refreshExpiresIn: 2592000,
          message: 'success'
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'customer_reset',
          phone: '+77009050988',
          fullName: 'Reset User'
        })
      );
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.requestPasswordResetSms('77009050988')).resolves.toEqual({ ok: true, data: true });
    await expect(client.verifyPasswordResetSms('77009050988', '4821')).resolves.toEqual({ ok: true, data: true });
    const result = await client.resetPasswordAndSignIn('77009050988', '4821', 'newpass1');

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'https://aman.kz/api/authmarket/forgot-password',
      expect.objectContaining({
        body: JSON.stringify({ phone: '77009050988', smsCode: '4821', password: 'newpass1' })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      'https://aman.kz/api/authmarket/sign-in',
      expect.objectContaining({
        body: JSON.stringify({ phone: '77009050988', password: 'newpass1' })
      })
    );
  });

  it('maps marketplace sign-up and forgot-password messages to existing auth errors', async () => {
    const client = createMarketplaceAuthClient({
      fetcher: vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            accessToken: null,
            expiresIn: 0,
            refreshToken: null,
            refreshExpiresIn: 0,
            message: 'Пользователь с таким номером уже существует'
          })
        )
        .mockResolvedValueOnce(Response.json({ first: 'Клиент отсутствует', second: 0 }))
        .mockResolvedValueOnce(Response.json({ first: 'Смс код неверный', second: 0 }))
    });

    await expect(client.requestSignUpSms('77009050988')).resolves.toEqual({ ok: false, error: 'NUMBER_EXISTS' });
    await expect(client.requestPasswordResetSms('77009050988')).resolves.toEqual({ ok: false, error: 'NUMBER_NOT_EXIST' });
    await expect(client.verifyPasswordResetSms('77009050988', '1111')).resolves.toEqual({ ok: false, error: 'INVALID_CODE' });
  });

  it('maps marketplace 5xx (sign-up SMS RuntimeException) to SERVER_ERROR, not a code error', async () => {
    // 复现客户注册故障:后端发短信步骤 500,响应体无 message 字段。
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Internal server error',
          error: 'RuntimeException',
          path: '/authmarket/sign-up'
        },
        { status: 500 }
      )
    );
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.requestSignUpSms('77011234567')).resolves.toEqual({ ok: false, error: 'SERVER_ERROR' });
    await expect(client.signIn('77011234567', 'pass1234')).resolves.toEqual({ ok: false, error: 'SERVER_ERROR' });
  });

  it('maps network/fetch failures to SERVER_ERROR', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.requestSignUpSms('77011234567')).resolves.toEqual({ ok: false, error: 'SERVER_ERROR' });
    await expect(client.requestPasswordResetSms('77011234567')).resolves.toEqual({ ok: false, error: 'SERVER_ERROR' });
  });

  it('refreshes rotated marketplace tokens', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        accessToken: 'access_next',
        expiresIn: 3600,
        refreshToken: 'refresh_next',
        refreshExpiresIn: 2592000,
        message: null
      })
    );
    const client = createMarketplaceAuthClient({ fetcher });

    await expect(client.refresh('refresh_old')).resolves.toEqual({
      ok: true,
      data: {
        accessToken: 'access_next',
        refreshToken: 'refresh_next'
      }
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://aman.kz/api/authmarket/refresh',
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: 'refresh_old' })
      })
    );
  });
});
