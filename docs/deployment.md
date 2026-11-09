# Tamga Deployment

## Cloudflare Workers

Tamga deploys as a full-stack Next.js app on Cloudflare Workers through OpenNext. Do not use the Cloudflare Pages static export preset.

In Cloudflare:

```text
Workers & Pages -> tamga -> Settings -> Builds
```

Use these settings:

- Git repository: `kaitogogo123-maker/tamga`
- Production branch: `main`
- Root directory: `/`
- Build command: `pnpm run cf:build`
- Deploy command: `pnpm run cf:deploy`
- Non-production branch deploy command: `pnpm run cf:upload`

Enable the Worker URL:

```text
Workers & Pages -> tamga -> Settings -> Domains & Routes -> workers.dev
```

The temporary preview URL should look like:

```text
https://tamga.<account>.workers.dev
```

Use that value for `APP_BASE_URL`.

## Vercel Legacy

Import the GitHub repository:

```text
https://github.com/kaitogogo123-maker/tamga
```

Use these settings:

- Framework Preset: Next.js
- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output Directory: keep default

## First Deployment: Mock Mode

Set only these variables:

```bash
MOCK_MODE=true
APP_BASE_URL=https://tamga.<account>.workers.dev
DEVICE_DAILY_QUOTA=10
```

After deploy, check:

```text
https://tamga.<account>.workers.dev/ru
https://tamga.<account>.workers.dev/api/v1/health
```

The health endpoint should return `mode: "mock"` and `ok: true`.

## Real Mode Variables

When real providers are ready, set:

```bash
MOCK_MODE=false
FAL_KEY=
FAL_WEBHOOK_SECRET=

ALI_DASHSCOPE_KEY=
ALI_DASHSCOPE_ENDPOINT=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_UPLOADS=tamga-uploads
R2_BUCKET_RESULTS=tamga-results
R2_PUBLIC_URL=

DATABASE_URL=
REDIS_URL=
APP_BASE_URL=https://tamga.<account>.workers.dev
DEVICE_DAILY_QUOTA=10
SENTRY_DSN=
```

`REDIS_URL` is reserved for quota and async task coordination. It can stay empty currently because task history now uses `DATABASE_URL`.

Then check:

```text
https://tamga.<account>.workers.dev/api/v1/health
```

If a required P0 key is missing, the endpoint returns HTTP `503` with the `missing` list.

## Incremental Provider Cutover

Use this order to reduce risk:

1. Keep `MOCK_MODE=true` and verify the deployed app.
2. Add `ALI_DASHSCOPE_KEY` while still in mock mode.
3. Set `MOCK_MODE=false` only after all P0 keys are present.
4. Verify `/api/v1/health` returns `mode: "real"` and `ok: true`.

The translation endpoint uses Qwen-MT only when `MOCK_MODE=false` and `ALI_DASHSCOPE_KEY` exists. Otherwise it stays on the mock translator.

The generation service uses fal.ai only when `MOCK_MODE=false` and `FAL_KEY` exists. The upload endpoint writes to R2 only when `MOCK_MODE=false` and R2 credentials exist; otherwise it returns the mock source image URL.

For real fal.ai generation, either set `R2_PUBLIC_URL` to a public bucket/custom-domain prefix or leave it empty and Tamga will return a temporary R2 presigned GET URL.

Task history uses in-memory storage in mock mode. In real mode, set `DATABASE_URL` from Neon so generated tasks survive serverless restarts.
