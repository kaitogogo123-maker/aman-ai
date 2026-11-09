import { describe, expect, it } from 'vitest';
import { collectLoginContext, parseUserAgent } from '@/lib/core/admin/request-context';
import { NextRequest } from 'next/server';

describe('parseUserAgent', () => {
  it('detects iOS Safari mobile', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ os: 'iOS', browser: 'Safari', device: 'Mobile' });
  });

  it('detects Android Chrome mobile', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ os: 'Android', browser: 'Chrome', device: 'Mobile' });
  });

  it('detects Windows desktop Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ os: 'Windows', browser: 'Chrome', device: 'Desktop' });
  });

  it('detects Instagram in-app browser on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0';
    expect(parseUserAgent(ua)).toEqual({ os: 'iOS', browser: 'Instagram', device: 'Mobile' });
  });

  it('detects Android native app via okhttp', () => {
    expect(parseUserAgent('okhttp/4.9.0')).toMatchObject({ os: 'Android', browser: 'App' });
  });

  it('returns empty object for missing UA', () => {
    expect(parseUserAgent(undefined)).toEqual({});
  });
});

describe('collectLoginContext', () => {
  it('extracts IP and UA-derived fields from headers, dropping empties', () => {
    const req = new NextRequest('https://tamga.example/api/v1/auth/login', {
      headers: {
        'cf-connecting-ip': '203.0.113.7, 10.0.0.1',
        'cf-ipcountry': 'KZ',
        'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
      }
    });
    const ctx = collectLoginContext(req);
    expect(ctx.ip).toBe('203.0.113.7');
    expect(ctx.country).toBe('KZ');
    expect(ctx.os).toBe('iOS');
    expect(ctx.device).toBe('Mobile');
    expect(ctx.lang).toBe('ru-RU');
    // cf 对象在测试环境不可用,城市等应被省略而非报错
    expect(ctx.city).toBeUndefined();
    expect('region' in ctx).toBe(false);
  });
});
