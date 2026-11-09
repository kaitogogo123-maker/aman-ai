import { describe, expect, it } from 'vitest';
import { resolveRuntimeReadiness } from '@/lib/config/runtime-readiness';

describe('resolveRuntimeReadiness', () => {
  it('is ready in mock mode without third-party credentials', () => {
    expect(
      resolveRuntimeReadiness({
        MOCK_MODE: true
      })
    ).toEqual({
      ok: true,
      mode: 'mock',
      imageProvider: 'mock',
      translationProvider: 'mock',
      storageProvider: 'memory',
      taskStore: 'memory',
      missing: []
    });
  });

  it('reports missing credentials when real mode is requested', () => {
    expect(
      resolveRuntimeReadiness({
        MOCK_MODE: false,
        FAL_KEY: '',
        ALI_DASHSCOPE_KEY: '',
        R2_ACCOUNT_ID: '',
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
        DATABASE_URL: '',
        REDIS_URL: ''
      })
    ).toEqual({
      ok: false,
      mode: 'real',
      imageProvider: 'fal.ai',
      translationProvider: 'qwen-mt',
      storageProvider: 'r2',
      taskStore: 'postgres',
      missing: [
        'FAL_KEY',
        'ALI_DASHSCOPE_KEY',
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'DATABASE_URL'
      ]
    });
  });

  it('is ready in real mode when all currently wired P0 credentials exist', () => {
    expect(
      resolveRuntimeReadiness({
        MOCK_MODE: false,
        FAL_KEY: 'fal_x',
        ALI_DASHSCOPE_KEY: 'dash_x',
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'access',
        R2_SECRET_ACCESS_KEY: 'secret',
        DATABASE_URL: 'postgres://example'
      }).ok
    ).toBe(true);
  });
});
