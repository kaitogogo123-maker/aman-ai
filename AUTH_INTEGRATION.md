# Auth 集成进度（Marketplace API）

> 状态：**真实 API base 已确认：`https://aman.kz/api`**。生产配置 `AUTH_PROVIDER=marketplace` 时，我方 `/api/v1/auth/*` 已代理 Marketplace 登录/注册/找回，并继续签本地 `aman_session` 保障 `/me`、生成扣费、任务归属不被半切断。
> 最后更新：2026-06-06

## 1. API base 结论

客户 R&D 给的 auth 文档（`~/Downloads/AUTH_API_DOCUMENTATION.md`）里 base URL 仍是占位符
（"replace with the actual server address, e.g. https://api.example.com"）。2026-06-06 客户研发反馈改为走 `/api` 示例：

- `POST https://aman.kz/api/authmarket/sign-in` 已实测返回 Marketplace JSON（错误密码时 `message: "Неверно учетные данные"`），不再是 Next 404。
- `GET https://aman.kz/api/profile/info` 未带 token 时返回 `401 Unauthorized`，说明 `/api/profile/info` 已代理到真实后端。
- 旧结论仍保留作背景：`aman.kz` 根路径是**前端站（Next.js）**。`/authmarket/sign-in`、`/authmarket/sign-up`、
  `/profile/info`、连业务接口 `/products/get-all/with-image` 全部返回 Next 的
  `404: This page could not be found`；必须使用 `/api` 前缀。
- Swagger 仍在 `/swagger-ui` 和 `/v3/api-docs`，且 2026-06-05 起需 **nginx basic auth**
  （basic auth 凭证不写在本文件 —— 见本地记忆 / 向 Kaito 索取，勿入库/前端）。
- swagger 里 `servers: "https://aman.kz"` 是 Spring 自动生成默认值（"Generated server url"），**真实可达 API base 应视为 `https://aman.kz/api`**。
- `api./back./auth./backend./gateway.aman.kz` 全部 DNS 解析失败。

当前代码新增：
- `MARKETPLACE_API_BASE_URL` 默认 `https://aman.kz/api`（可由 env 覆盖）。
- `AUTH_PROVIDER=marketplace` 时，`app/api/v1/auth/{login,request-otp,verify-otp,register,recover}` 走 Marketplace；默认开发值仍为 `local`，避免本地无真实账号/SMS 时无法调试。
- `lib/core/auth/marketplace-client.ts`：服务端 Marketplace client，覆盖 sign-in、sign-up 三步、forgot-password 三步、refresh、`/profile/info`。
- `lib/core/auth/marketplace-session.ts`：Marketplace 成功后同步 shadow local user，签现有 httpOnly `aman_session`，并额外保存 Marketplace access/refresh token 到 httpOnly cookie。
- 密码规则已与 Marketplace 对齐为 **4–20 位**。

仍需确认/继续：
- 用客户提供的真实测试账号完成成功登录 + `/profile/info` schema 实测。
- 用客户提供的可接 SMS 测试手机号完成注册/找回全流程实测。
- 钱包/扣费/任务用户 id 与 Marketplace customer id 的关系。
- Cloudflare Workers 生产出口是否被后端限制（目前本地 curl 可通；仍需部署后实测）。

## 2. 集成设计（地址到位后照此实现）

**契约要点**（来自 auth 文档）：
- 鉴权：JWT Bearer token。响应**恒为 HTTP 200**，靠 body 里的 `message`/`first` 字段判断结果（俄语/哈萨克语文案）。
- 密码规则：与 Marketplace 对齐 **4–20 位**（当前自建版规则需改）。
- 来源标记：请求带 `fromWho`，值 `aman_ai`（落地时从 `?from=` / `utm_source` cookie 取，缺省 `aman_ai`）。
- 用户标识：登录后调 `/profile/info`，取返回的 customer `id` 作为用户唯一标识。

**端点映射**（我方 `/api/v1/auth/*` 代理 → `https://aman.kz/api/authmarket/*`）：
| 我方现有路由 | Marketplace 端点 | 备注 |
|---|---|---|
| `register`（+ `request-otp`/`verify-otp`） | `POST /authmarket/sign-up` | 3 步：发码→验码→填资料（按 `smsCode`/`fullName` 空否区分步骤） |
| `login` | `POST /authmarket/sign-in` | 成功拿 JWT |
| `recover` | `POST /authmarket/forgot-password` | 3 步流程 |
| （刷新） | `POST /authmarket/refresh` | refresh token 换新 access |
| `me` | `GET /profile/info` | 带 Bearer，取 `id` |

**存储**：JWT 存 **httpOnly cookie**（沿用现有 `lib/core/auth/cookie.ts` 模式）。

## 3. 现有自建 auth（过渡版，待替换的接入点）

- API 路由：`app/api/v1/auth/{login,logout,me,recover,register,request-otp,verify-otp}/`
- 核心库：`lib/core/auth/`（`service.ts` 业务、`postgres-auth-store.ts` 存储、`sms.ts` 短信
  （sandbox 不真发）、`session.ts`/`cookie.ts` 会话、`password.ts` 规则、`otp.ts`、`rate-limit.ts`）
- 前端：`components/auth-flow.tsx`（登录/注册/找回 UI）、`components/header-auth.tsx`（顶部登录态）

**接入策略**：新增 `lib/core/auth/marketplace-client.ts` 封装对真实 base 的调用，
让 `app/api/v1/auth/*` 改为代理 Marketplace（替换 `service.ts` 的自建实现），
前端 `auth-flow.tsx`/`header-auth.tsx` 基本不动（接口契约保持）。

## 4. 约束（勿违反）

- tamga commit/PR **不带任何 Claude/AI 署名**，commit message 用中文。
- 服务端密钥（`AUTH_SECRET`/`DATABASE_URL`/`FAL_KEY`/swagger basic auth）只在服务端 env / 本地 shell，**绝不进客户端 bundle**。
- 不改 `env.ts` 的 R2 默认值（`tamga-uploads`/`tamga-results`）、`sessionStorage` key（`tamga_recent_batch`）等既有约定。
