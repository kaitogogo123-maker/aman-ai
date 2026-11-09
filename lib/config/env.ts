import { z } from 'zod';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const booleanStringSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  return value;
}, z.boolean());

const envSchema = z.object({
  AUTH_PROVIDER: z.enum(['local', 'marketplace']).default('local'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  PAYMENT_PROVIDER: z.enum(['disabled', 'external']).default('disabled'),
  DEVICE_DAILY_QUOTA: z.coerce.number().int().positive().default(10),
  MOCK_MODE: booleanStringSchema.default(true),
  FAL_KEY: z.string().optional(),
  // 仅用于后台账户余额查询(GET /v1/account/billing 需 Admin key);生图仍用 FAL_KEY。
  FAL_ADMIN_KEY: z.string().optional(),
  FAL_WEBHOOK_SECRET: z.string().optional(),
  ALI_DASHSCOPE_KEY: z.string().optional(),
  ALI_DASHSCOPE_ENDPOINT: z
    .string()
    .default('https://dashscope-intl.aliyuncs.com/compatible-mode/v1'),
  ALI_DASHSCOPE_ANALYSIS_TEXT_MODEL: z.string().default('qwen3.5-plus'),
  ALI_DASHSCOPE_ANALYSIS_VISION_MODEL: z.string().default('qwen3-vl-plus'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_UPLOADS: z.string().default('tamga-uploads'),
  R2_BUCKET_RESULTS: z.string().default('tamga-results'),
  R2_PUBLIC_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  // 会话签名密钥(HMAC)。生产务必用 wrangler secret 覆盖此默认值。
  AUTH_SECRET: z.string().default('aman-ai-dev-secret-change-me'),
  ADMIN_PASSWORD: z.string().optional(),
  // 短信 sandbox:true 时不发真短信、验证码随响应回传(联调用);接客户短信网关后置 false。
  AUTH_SMS_SANDBOX: booleanStringSchema.default(true),
  MARKETPLACE_API_BASE_URL: z.string().url().default('https://aman.kz/api'),
  // 支付网关(POST /payments,见 docs/aman-payment-api-integration-guide.md)。对方自有服务(非银行直连),
  // 同一 host 测试/生产通用(研发 2026-06-12 确认)。host = testbcc.amanal.kz(已 DNS 实测可达;
  // 研发口述的 tecc.bcc.amanal.kz 无解析,是手误)。如有变更用 secret 覆盖。
  PAYMENT_API_BASE_URL: z.string().url().default('https://testbcc.amanal.kz'),
  PAYMENT_CREATE_PATH: z.string().default('/payments')
});

type EnvInput = Record<string, unknown>;

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: EnvInput): AppEnv {
  return envSchema.parse(input);
}

export function parseRuntimeEnv(
  processEnv: EnvInput,
  cloudflareEnv: EnvInput = {}
): AppEnv {
  return parseEnv({
    ...pickSerializableEnv(processEnv),
    ...pickSerializableEnv(cloudflareEnv)
  });
}

export function getRuntimeEnv(): AppEnv {
  return parseRuntimeEnv(process.env, readCloudflareEnv());
}

function readCloudflareEnv(): EnvInput {
  try {
    return getCloudflareContext().env as EnvInput;
  } catch {
    return {};
  }
}

function pickSerializableEnv(input: EnvInput): EnvInput {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value)
    )
  );
}
