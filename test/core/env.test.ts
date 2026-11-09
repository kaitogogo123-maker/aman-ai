import { describe, expect, it } from 'vitest';
import { parseEnv, parseRuntimeEnv } from '@/lib/config/env';

describe('parseEnv', () => {
  it('parses the string "false" as false for Vercel environment variables', () => {
    const env = parseEnv({
      MOCK_MODE: 'false'
    });

    expect(env.MOCK_MODE).toBe(false);
  });

  it('keeps mock mode enabled by default', () => {
    const env = parseEnv({});

    expect(env.MOCK_MODE).toBe(true);
    expect(env.AUTH_PROVIDER).toBe('local');
  });

  it('defaults the marketplace API base to the aman.kz api proxy', () => {
    const env = parseEnv({});

    expect(env.MARKETPLACE_API_BASE_URL).toBe('https://aman.kz/api');
  });

  it('uses Cloudflare runtime bindings over process.env defaults', () => {
    const env = parseRuntimeEnv(
      {
        MOCK_MODE: 'true'
      },
      {
        MOCK_MODE: 'false',
        DATABASE_URL: 'postgres://neon.example/tamga'
      }
    );

    expect(env.MOCK_MODE).toBe(false);
    expect(env.DATABASE_URL).toBe('postgres://neon.example/tamga');
  });
});
