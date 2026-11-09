import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUid: vi.fn(),
  topup: vi.fn(),
  runtimeEnv: {
    MOCK_MODE: false
  }
}));

vi.mock('@/lib/core/auth/cookie', () => ({
  getSessionUid: mocks.getSessionUid
}));

vi.mock('@/lib/core/auth/runtime', () => ({
  createRuntimeAuthService: () => ({
    topup: mocks.topup
  })
}));

vi.mock('@/lib/config/env', () => ({
  getRuntimeEnv: () => mocks.runtimeEnv
}));

import { POST } from '@/app/api/v1/wallet/topup/route';

describe('POST /api/v1/wallet/topup', () => {
  beforeEach(() => {
    mocks.getSessionUid.mockReset();
    mocks.topup.mockReset();
    mocks.runtimeEnv.MOCK_MODE = false;
  });

  it('blocks direct mock top-up when mock mode is disabled', async () => {
    mocks.getSessionUid.mockResolvedValue('usr_1');
    mocks.topup.mockResolvedValue({ balance: 1000 });

    const response = await POST(
      new Request('https://tamga.example/api/v1/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: 1000 }),
        headers: { 'content-type': 'application/json' }
      }) as never
    );

    await expect(response.json()).resolves.toEqual({ error: 'PAYMENT_NOT_CONFIGURED' });
    expect(response.status).toBe(503);
    expect(mocks.topup).not.toHaveBeenCalled();
  });
});
