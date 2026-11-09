# Aman AI — AI 商品图服务

面向哈萨克斯坦电商卖家的 AI 商品图服务：上传一张商品照片，生成可直接用于店铺的主图和模特图。界面支持俄语、哈萨克语、英语、中文。

线上地址：https://tamga.kaitogogo123.workers.dev

An AI product-photo service for e-commerce sellers in Kazakhstan. Upload one product photo, get store-ready product shots or model shots. Next.js on Cloudflare Workers, Qwen-VL for product analysis, fal.ai image models for generation, connected to the client's marketplace accounts and payment.

## 做了什么

- **商品识别 → 提示词**：用 Qwen3-VL 读商品图，提取品类、材质、颜色、卖点，按「商品图 / 模特图」两种模式组装生成提示词；用户可以在文本框里改写后再生成。
- **多模型生成**：通过 fal.ai 调用多种图像编辑模型（nano-banana、gpt-image 等），模型可配置切换；生成是异步任务，前端通过 SSE 实时拿进度。
- **多语言**：界面四种语言；用户输入的商品描述用 Qwen-MT 翻译后再进提示词。
- **账号与支付**：登录、注册、找回密码对接客户的电商平台账号（代理平台的认证接口）；按张数购买额度，对接平台支付，回调后入账，额度流水记在 Postgres。
- **运营后台**：`/admin/accounting` 按日期看充值金额、生成张数和额度消耗，支持导出。
- **部署**：Next.js 16 + OpenNext 跑在 Cloudflare Workers 上；图片存 R2，数据存 Neon Postgres。没有外部 key 时整套可在 mock 模式下本地运行。

## 技术栈

Next.js 16（App Router）、React 19、TypeScript、Tailwind CSS 4、Zod、Zustand · Cloudflare Workers（OpenNext）、R2 · Neon Postgres · Qwen3-VL / Qwen-MT（DashScope）· fal.ai · Vitest

## 目录

```
app/[locale]/        页面：首页、生成、结果、历史、订单、价格、登录注册
app/api/v1/          接口：analyze-product、generate、task（含 SSE events）、upload、translate、auth、payments、orders、wallet、admin
lib/core/analysis/   商品图识别（Qwen-VL）和提示词组装
lib/core/generation/ 生成任务、fal.ai provider、任务存储（内存 / Postgres）
lib/core/translation/ Qwen-MT 翻译
lib/core/auth/       平台账号代理、会话、限流
lib/core/payment/    额度包、下单、支付回调
lib/core/admin/      会计后台
test/core/           Vitest 单元测试（59 个文件）
docs/                对接说明和部署文档
```

## 本地运行

```bash
pnpm install
pnpm dev        # http://localhost:3000/ru ，默认 mock 模式，不需要任何 key
pnpm test
```

接真实服务时，把 `.env.example` 复制为 `.env.local` 并填写 `ALI_DASHSCOPE_KEY`、`FAL_KEY`、`R2_*`、`DATABASE_URL`。部署到 Cloudflare 见 [docs/deployment.md](docs/deployment.md)。

## 说明

为客户开发的项目，个人负责前后端、模型接入和部署。仓库内不含任何密钥，测试和文档中的账号、手机号均为虚构或已替换。
