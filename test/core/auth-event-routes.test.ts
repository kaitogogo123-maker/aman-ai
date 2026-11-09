import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  record: vi.fn()
}));

vi.mock('@/lib/config/env', () => ({
  getRuntimeEnv: () => ({
    AUTH_PROVIDER: 'local',
    AUTH_SECRET: 'auth-event-route-secret',
    MARKETPLACE_API_BASE_URL: 'https://aman.kz/api',
    MOCK_MODE: true
  })
}));

vi.mock('@/lib/core/auth/runtime', () => ({
  createRuntimeAuthService: () => ({
    login: mocks.login,
    register: mocks.register
  })
}));

vi.mock('@/lib/core/auth/auth-events', () => ({
  createRuntimeAuthEventRecorder: () => ({
    record: mocks.record
  })
}));

import { POST as loginPOST } from '@/app/api/v1/auth/login/route';
import { POST as registerPOST } from '@/app/api/v1/auth/register/route';

describe('auth routes event recording', () => {
  beforeEach(() => {
    mocks.login.mockReset();
    mocks.register.mockReset();
    mocks.record.mockReset();
  });

  it('records a login event after successful local login', async () => {
    mocks.login.mockResolvedValue({
      ok: true,
      data: {
        token: 'session_token',
        user: publicUser('usr_login')
      }
    });

    const response = await loginPOST(jsonRequest('/api/v1/auth/login', { phone: '77000000001', password: 'pass1234' }));

    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith({
      userId: 'usr_login',
      type: 'login',
      metadata: { provider: 'local' }
    });
  });

  it('records a register event after successful local registration', async () => {
    mocks.register.mockResolvedValue({
      ok: true,
      data: {
        token: 'session_token',
        user: publicUser('usr_register')
      }
    });

    const response = await registerPOST(
      jsonRequest('/api/v1/auth/register', {
        phone: '77000000002',
        code: '1234',
        firstName: 'Aina',
        lastName: 'B',
        email: 'aina@example.com',
        password: 'pass1234'
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith({
      userId: 'usr_register',
      type: 'register',
      metadata: { provider: 'local' }
    });
  });
});

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://tamga.example${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }) as never;
}

function publicUser(id: string) {
  return {
    id,
    phone: '77000000001',
    firstName: 'Aina',
    lastName: 'B',
    email: 'aina@example.com',
    balance: 0
  };
}

