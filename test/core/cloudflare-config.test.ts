import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wranglerConfig = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8')) as {
  vars?: Record<string, string>;
};

describe('Cloudflare runtime config', () => {
  it('uses Marketplace auth in production', () => {
    expect(wranglerConfig.vars?.AUTH_PROVIDER).toBe('marketplace');
    expect(wranglerConfig.vars?.MARKETPLACE_API_BASE_URL).toBe('https://aman.kz/api');
  });

  it('uses a vision-capable model for image analysis in production', () => {
    expect(wranglerConfig.vars?.ALI_DASHSCOPE_ANALYSIS_TEXT_MODEL).toBe('qwen3.5-plus');
    expect(wranglerConfig.vars?.ALI_DASHSCOPE_ANALYSIS_VISION_MODEL).toBe('qwen3-vl-plus');
  });
});
