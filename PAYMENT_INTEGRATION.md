# Payment & Orders Integration

Status doc for the AMAN AI (tamga) ↔ aman.kz marketplace payment / orders integration.
Last updated: 2026-06-17.

Related: [`AUTH_INTEGRATION.md`](./AUTH_INTEGRATION.md) (auth is live), [`docs/codex-handoff-2026-06-08.md`](./docs/codex-handoff-2026-06-08.md), and the recorded specs in [`docs/aman-payment-api-integration-guide.md`](./docs/aman-payment-api-integration-guide.md), [`docs/aman-profile-orders-api.md`](./docs/aman-profile-orders-api.md), [`docs/aman-auth-api.md`](./docs/aman-auth-api.md).

---

## 0. CURRENT STATE (2026-06-17) — read this first; supersedes older sections below

The model changed several times. The **current, customer-confirmed** design:

**Pay-per-generation. No balance, no top-up, no pre-purchased packages, no image-credit system.** The user pays at generation time for exactly the number of images they choose.

Final flow: upload photos → select N images → we compute the total → create a dedicated **AI image-generation order** (NOT a marketplace product order; independent of any product ID or product price; it exists only to track the payment and link it to the images) → pay the **exact computed amount** via `POST /payments` (Option B) → on confirmed payment, generate immediately → show results → save in "My Orders".

Pricing (the customer's numbers): 1–4 images = 500 KZT each; 5+ images = 300 KZT each (so 5 = 1,500). ⚠️ This has a price inversion: 4 images (2,000) costs more than 5 (1,500) — flagged to the customer, not yet resolved (internal pricing question, not a code issue).

**Code state:**
- UI already aligned (commit 7e54a3c): pricing page button is **"Start"** → goes to the generation page (no "Buy"); header **no longer shows balance or "Top up"**.
- The earlier package/credit work (方案1: `creditOnce`, `settlePaidPackages`, image-credit balance, generate route deducting credits, `packages.ts` product IDs 760/628/753/874/878) is now **obsolete and dormant** — to be removed/reworked into the pay-per-generation flow. Generate route currently still deducts a credit per image, so generation is effectively blocked for users with no credit until the new flow is built. (mkt_360 test account has 100 credits.)
- `POST /payments` (BCC gateway `testbcc.amanal.kz`) is **IP-blocked to us: HTTP 403 on every path**. We have no fixed outbound IP (Cloudflare), so token-based access is required.

**Blocked on the customer (4 open questions sent 2026-06-17):**
1. How to create the AI generation order (endpoint, request, what id it returns) and how its payment status is read/confirmed (poll which endpoint, or webhook).
2. How that order id is passed to `/payments` together with our computed amount.
3. Token-based access to `/payments` (it's 403 to us) + Sandbox/Production credentials.
4. Refund/cancel endpoint (for "paid but generation failed" → auto-refund).
5. Where "My Orders" lives — do we push generated results back to the AI order (which endpoint), or is history on our app side?

**Already known (from `docs/aman-payment-api-integration-guide.md` + dev answers, don't re-ask):** `/payments` body shape, currency 398 = KZT, integer tenge, `{token, url}` response, Idempotency-Key behavior, no test cards (real-card testing). Note: the "poll `/profile/orders` for `PAID_AND_CREATED`" model was for the abandoned create-order/product flow, NOT for the direct-`/payments` flow.

**Verified live (2026-06-16, account +77000000099 / 123456):** login; the old create-order path (`POST /internal/order/create` → `{token:"order:<paymentId>", url}`, charges product price, can't override). The new pay-per-generation flow is NOT yet implemented (blocked on the 4 questions).

---

## 1. Current state

| Module | State | Notes |
| --- | --- | --- |
| Marketplace auth | ✅ live | `/authmarket/sign-up` (3-step), `/sign-in`, `/forgot-password`, `/refresh`, `/profile/info`. Base `https://aman.kz/api`. |
| Order history | 🟡 integrated, **not yet verified against live data** | `GET /profile/orders?country=kz\|ch`. See §3. |
| Top-up / payment | ❌ **stub only** | `lib/core/payment/service.ts` returns `not_implemented`; `PAYMENT_PROVIDER=disabled` in prod. The header "+" top-up button shows "payment not configured". Blocked on the open questions in §4. |

### Wallet (important)

AI image-generation credits are currently deducted from a balance we keep in our **own Neon Postgres** (`auth_users.balance`, ledger in `credit_ledger`). On first marketplace login we copy the `balance` from `/profile/info` once; we do **not** re-sync afterwards.

`/profile/info` also returns a `balance` field. **It is not yet decided whether the authoritative AI-credit wallet is ours or the marketplace's.** This must be resolved before the payment flow can be implemented — see §4 A4/A5. Risk: two diverging balances.

### Redirect / callback URLs already proposed to the client

- Success: `https://tamga.kaitogogo123.workers.dev/ru/app?payment=success`
- Failed / cancelled: `https://tamga.kaitogogo123.workers.dev/ru/app?payment=failed`
- Server callback / webhook: `https://tamga.kaitogogo123.workers.dev/api/v1/payments/callback`

Rule we will follow: the redirect URL only returns the user to the app. The balance is credited **only** after the backend receives a trusted payment confirmation / verified status — never from the redirect alone.

---

## 1b. Decisions & finalized flow (resolved 2026-06-12)

**Resolved:**
- **Wallet ownership = AMAN AI (our side).** The AI-credit balance stays in our Neon Postgres (`auth_users.balance` + `credit_ledger`). Marketplace does NOT store it and does not need our balance structure. (Confirmed by Kaito; client dev agreed pending business sign-off, business now OK.)
- **Payment status = poll `GET /profile/orders`**, order is paid when `statusOfOrder == PAID_AND_CREATED` (confirmed by client dev). No separate by-id status endpoint needed.
- `currency: 398` = KZT; `amount` decimal; `client_ip_address` from Cloudflare `CF-Connecting-IP`.

**Finalized top-up flow:**
1. User taps "Пополнить" → pricing page → selects amount.
2. We create a top-up order on marketplace → obtain `order_id`. **(BLOCKER A: how to create a top-up order — see below.)**
3. We call create-payment `{order_ids, amount, currency:398, description, client_ip_address}` → response gives `paymentId` + payment-page URL. **(BLOCKER B: endpoint URL + response fields — see below.)**
4. Redirect user to the payment-page URL; they pay; return to `/{locale}/app?payment=success|failed`.
5. We poll `GET /profile/orders`; when the order is `PAID_AND_CREATED`, we credit `auth_users.balance` (+ `credit_ledger`), idempotent by order_id / paymentId.
6. Generation deducts from that balance as today.

**Resolved (client dev, 2026-06-12):** create-order IS payment initiation. `POST /internal/order/create` (and `create-v2`) returns `CreatePaymentResponse { url, token }` — `url` is the bank payment-page link we open for the client, `token` is the bank token. So there is no separate create-payment call; blocker A is answered. (`OrderDTO` from `/profile/orders` also carries `paymentId` + `url`.)

**Remaining blocker — B. Top-up request body:** `CreateOrderRequest` is physical-goods oriented (`productIds, specIds, filialId, deliveryMethod, cityId, ...`). The dev's earlier example body was `{order_ids, amount, currency, client_ip_address}`, which does not match `CreateOrderRequest`. For an AI balance top-up (no physical product) we need the exact body to POST to `/internal/order/create`: a dedicated top-up product/SKU inside `CreateOrderRequest`, or the simplified `{order_ids, amount, ...}` form (and to which endpoint). Also: how to read the created order's id back so we can poll `/profile/orders` and credit on `PAID_AND_CREATED`.

**Exhaustive swagger scan (2026-06-12):** all 91 endpoints reviewed. The marketplace has **no wallet / balance / top-up / deposit endpoint** (`пополнение/баланс/wallet/topup/deposit` = 0 hits; the 5 `balance` hits are all `balanceInStock` = product stock). `order_ids` / `client_ip` appear 0 times. This confirms the AI-credit wallet must live on our side, and a "top-up" has to be modeled as an order via `/internal/order/create` (which returns `CreatePaymentResponse {url, token}`); only the top-up request body is unknown.

**Built on our side (committed, behind the missing body):**
- `lib/core/auth` — `creditOnce(userId, amount, reference, reason)`: idempotent crediting keyed by `led_<reference>` (postgres single-CTE on-conflict + memory impl), prevents double-credit. Exposed as `authService.creditOnce`.
- `lib/core/payment/status.ts` — `PAID_ORDER_STATUS = 'PAID_AND_CREATED'`, `isOrderPaid`, `findOrderStatus(baseUrl, accessToken, orderId)` (scans `/profile/orders` kz+ch).
- `lib/core/payment/marketplace-payment.ts` — `createPayment(baseUrl, {orderIds, amount, clientIp}, {idempotencyKey})` matching the real contract (POST `/payments` on the BCC gateway, `Idempotency-Key` header, snake_case body `{order_ids, amount, currency:398, description:"AMAN AI", client_ip_address}`, returns `{token, url}`, 409 → `PaymentInitializingError`); and `verifyAndCreditOrder(...)` (poll status → idempotent credit by `orderPrice`). Both unit-tested.
- `lib/core/payment/client-ip.ts` — `getClientIp` (Cloudflare `CF-Connecting-IP`).
- `env.ts` — `PAYMENT_API_BASE_URL` (default `https://testbcc.amanal.kz`, prod TBD), `PAYMENT_CREATE_PATH` (`/payments`).

**Blocker A — RESOLVED (2026-06-12):** full payment contract received → [`docs/aman-payment-api-integration-guide.md`](./docs/aman-payment-api-integration-guide.md). `POST /payments` (BCC gateway `testbcc.amanal.kz`), `Idempotency-Key`, body `{order_ids, amount, currency:398, description:"AMAN AI", client_ip_address}`, returns `{token, url}` (redirect customer to `url`). No webhook to us; bank callback flips the order to `PAID_AND_CREATED`; we poll `/profile/orders`. Per the guide, `APPROVED` = funds captured (terminal) and the order becomes `PAID_AND_CREATED` on success — both are safe to treat as paid (idempotency prevents double-credit).

**Only remaining input — B (product/business):** `POST /payments` pays for **existing `order_ids`** ("amount must equal the combined total of the orders"). An AI top-up has no physical product, so how the top-up order is created (to get an `order_id` priced at the top-up amount) is undefined and is a product/business decision, not a dev one. Until defined, the order-creation step + the public top-up route stay unbuilt. **Security:** `verifyAndCreditOrder` must only be called for top-up orders we created/tracked, never an arbitrary paid product order, else a user could claim a physical purchase as AI credit.

Other confirmations (2026-06-12): no test cards (business tests with real cards); amounts in whole tenge; deployment — our app + Neon DB on our own infra (Cloudflare), client dev asked to confirm this (#5).

---

## 2. Received from client dev

### `GET /profile/orders` — customer order history

- Auth: `Authorization: Bearer {accessToken}`. Customer is read from the JWT; frontend does not send `customerId`.
- Query: `country` (required, `kz` local / `ch` Chinese), `page` (0-based), `size`, `sort` (e.g. `createdDate,desc`).
- Response: `Page<OrderDTO>`. For `kz` read `productDTO`; for `ch` read `productChDTO`.
- Empty → `200` with empty page. Invalid token userId → `400` with `{content:[], empty:true}`.
- Swagger: `https://aman.kz/swagger-ui/index.html` (nginx basic auth `swag` / `k4JLR9nK`).

OrderDTO fields seen: `id, customerId, orderPrice, deliveryAddress, productId, comment, actual, productDTO, productChDTO, productPrice, filialDTO, statusOfOrder, statusDate, amountOfProduct, photoUrl[], paymentId, trackCode`.

### Create-payment request body (from client dev, 2026-06-12)

```json
{ "order_ids": [2060, 2061], "amount": 15000.00, "currency": 398, "description": "AMAN AI", "client_ip_address": "192.168.1.100" }
```
`currency: 398` = ISO-4217 numeric for KZT (tenge). `amount` is decimal. Payment is bound to pre-existing `order_ids` (create order(s) first, then pay). `client_ip_address` we can fill from Cloudflare `CF-Connecting-IP`.

### Reconstructed from swagger api-docs (2026-06-12)

Server `https://aman.kz/api` (basic auth `swag` / `k4JLR9nK` on `/v3/api-docs` + `/swagger-ui`). Relevant endpoints:

- **Payment status:** `GET /internal/order/paymentStatus?paymentId={id}` — poll this with the `paymentId` returned by create-payment. (200 response shape not documented in swagger.)
- **Create order:** `POST /internal/order/create` (and `create-v2`). `CreateOrderRequest` is physical-goods oriented: `productIds, specIds, isSubs, country, amount[], filialId, deliveryMethod, cityId, region, currency, fulloPrice, ...`.
- **Order status:** `GET /aman/order/status?orderId=`, `GET /aman/order/number/status?number=`.
- **Paid status value:** enum `Orders.status` = `WAITING_PAYMENT` (unpaid) → **`PAID_AND_CREATED`** (paid, to confirm) → ... → `CANCELLED` / `DECLINED` (failed). `OrderDTO.statusOfOrder` is a free string drawing from this vocabulary.

**Still NOT in swagger (doc-only):** the create-payment / initiate-payment endpoint itself. Neither `order_ids` nor `client_ip_address` appears anywhere in the api-docs, so its URL + method + response schema (the `paymentId` and the payment-page redirect-URL field) live only in the "Payment API — Integration Guide" document, which we do not have on file yet.

> Full marketplace OpenAPI snapshot saved at [`docs/aman-marketplace-api-docs.json`](./docs/aman-marketplace-api-docs.json) (fetched 2026-06-12 from `https://aman.kz/v3/api-docs`, basic auth `swag` / `k4JLR9nK`). 91 paths.

---

## 3. What we already built (orders)

- `app/api/v1/orders/route.ts` — proxy: reads `aman_market_access` cookie, calls `{MARKETPLACE_API_BASE_URL}/profile/orders`, auto-refreshes the access token (1h) via the refresh token (30d) on 401 and retries.
- `app/[locale]/orders/page.tsx` + `components/orders-client.tsx` — "My orders" page, kz/ch tabs, paginated "load more", thumbnail + name / price / status / qty / date / track code.
- `components/header-auth.tsx` — "Orders" link in the logged-in header.
- `lib/i18n.ts` — `orders` strings in ru/kk/en/zh.

**Not verified against live data** (needs a real marketplace token). Known minor TODOs: treat upstream `400` as an empty page; guard tab-switch race; localize statuses once the full enum is known (§4 #10).

---

## 4. Final open questions (2026-06-12)

Everything else is resolved (auth, order history + full status enum, poll model, `POST /payments` contract, currency/tenge, idempotency, no test cards). Only these remain.

### Product model — DECIDED (2026-06-12, customer lead + Mr. Li)

**No balance top-up.** Instead, **direct purchase of an AI image-generation service/package**: customer selects number of images → AMAN AI creates an order for the corresponding image-generation service/package (amount = package price) → gets `order_id` → pays via `POST /payments` → on success, AMAN AI grants the images. Our side (option B, confirmed): keep an internal image-credit balance — on a paid package order we credit by the package amount, generation deducts as today. User-facing = buying fixed packages (our existing pricing tiers); `Пополнить` → pricing page already fits.

**Package product IDs — RECEIVED (2026-06-13, customer lead, sellerId=2):** dedicated test products, one per package: `1 img → 760, 2 → 628, 3 → 753, 4 → 874, 5 → 878` (see `lib/core/payment/packages.ts`). We identify AMAN package orders in `/profile/orders` by `productId` ∈ this set → secure (never credit an arbitrary paid physical order), so no pending-purchase table needed. Settlement built: `settlePaidPackages()` scans paid AMAN orders and credits by `orderPrice` idempotently.

**Correction (2026-06-13, verified in swagger):** `POST /internal/order/create` returns `CreatePaymentResponse {token, url}` — **NOT an `order_id`**. So create-order also initiates payment (gives the bank `url` to redirect to); the lead's "get an order_id then POST /payments" wording doesn't match the actual API. We identify the resulting order by `productId` in `/profile/orders`, not by a returned id.

**LIVE TEST DONE (2026-06-16, account +77000000099 / 123456) — flow fully resolved:**

- **Create order:** `POST /internal/order/create` with minimal body `{ "productIds":[760], "amount":[1], "country":"kz" }` → `200 { "token":"order:1781592398334", "url":"https://auth.unicornlab.kz/auth/..." }`. No filial/delivery/city needed; backend auto-assigns them. **Flow is (a): create-order returns the payment `url` directly — we do NOT call `POST /payments` separately.** Redirect the user to `url`.
- **`token` = `order:<paymentId>`** — the digits are the order's `paymentId`. Parse them to know which order to settle.
- **OrderDTO in `/profile/orders` (real shape, richer than swagger summary):** top-level `paymentId` (= the token digits) is the stable key, `orderNumber` (e.g. `3013-JPOV`), `statusOfOrder`; **the product is nested at `items[].productId`** (top-level `productId`/`id` are null). `orderPrice` is the **marketplace product price** (test product 760 = "Prada" shoes, 32₸) — NOT our package price, so do not credit by `orderPrice`.
- **`/profile/info` has NO `balance` field** → confirms the wallet is entirely ours.

**Implemented to match (committed):** `settlePaidPackages` scans `/profile/orders`, finds paid orders whose `items[].productId` ∈ AMAN set, and credits `priceForCount(images)` keyed by `order_<paymentId>` (idempotent). `packages.ts` maps images↔productId.

**Frontend wiring — DONE + DEPLOYED (2026-06-16, commit 84aa025):** full flow live: pricing page "Купить" → `POST /api/v1/payments/orders {images}` → `createPackageOrder` → redirect to bank `url` → pay → return `?payment=success` → site-shell calls `POST /api/v1/payments/settle` → `settlePaidPackages` credits by package size (idempotent by `order_<paymentId>`) → header balance refreshes via `aman:balance-changed` event. Access-token refresh-on-401 handled; not-logged-in → redirect to login.

**Only remaining (product-side, customer):** the 5 products are placeholder test items (shoes, arbitrary 32₸ prices). The Buy button is LIVE in prod pointing at these (Kaito approved for internal testing — do NOT promote to real users yet). For real launch the customer must set proper "AI image package" products whose price = our package price (`priceForCount(n)`). Our crediting is by package size regardless, so functionally it works either way.

Cleanup later: `payment/service.ts` `createTopupOrder` is now unused (orders route uses `createPackageOrder`); left in place to avoid touching its test. `/payments/callback` + `handleCallback` are dead in the poll model but harmless.

### For dev

3. ~~Production base URL / host~~ — **RESOLVED (2026-06-12):** gateway is the client's own service (not the bank), **same host for test + prod**. Host = **`testbcc.amanal.kz`** (DNS-verified reachable; the dev's `tecc.bcc.amanal.kz` does not resolve — a typo). No need to re-ask.
4. **Create-order response** — when a top-up order is created, what does the response return (specifically the order `id`) so we can match it in `/profile/orders` and credit on `PAID_AND_CREATED`?
5. **IP allowlist?** Likely none (dev says the gateway is their own service, not banking), but confirm — our backend calls it from Cloudflare Workers with no fixed outbound IP; the call authenticates via `Idempotency-Key` + body only.

**Unblock:** #1 is the critical path; with it (plus #4) the whole top-up flow can be wired end to end (everything else is built).
