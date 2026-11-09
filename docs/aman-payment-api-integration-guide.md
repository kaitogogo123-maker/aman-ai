# Payment API — Integration Guide

> Source: client dev (BCC / Bank CenterCredit acquiring gateway). Recorded 2026-06-12.

## Overview

Payment initiation endpoint that creates a new payment session via the BCC acquiring gateway. Accepts order details, initiates a payment transaction, and returns a unique payment `token` plus a `url` where the customer must be redirected to complete payment.

## Endpoint

```
POST /payments
```

Host (TEST): `testbcc.amanal.kz` → base `https://testbcc.amanal.kz`. (Production host TBD.)

## Headers

| Header | Required | Description |
|---|---|---|
| `Idempotency-Key` | Yes | Unique key (UUID v4) per payment attempt. Retrying the same request with the same key does not create a duplicate payment. |
| `Content-Type` | Yes | `application/json` |

> No `Authorization` header is listed for `/payments` (unlike `/profile/orders`).

## Request body (snake_case)

| Field | Type | Required | Description |
|---|---|---|---|
| `order_ids` | Array[Long] | Yes | Internal order IDs to be paid. One payment can cover multiple orders. |
| `amount` | Decimal | Yes | Total amount in base unit (KZT). Must be > 0 and equal the combined total of the orders. |
| `currency` | Integer | Yes | ISO-4217 numeric. `398` = KZT. |
| `description` | String | Yes | **Must be `"AMAN AI"`.** |
| `client_ip_address` | String | Yes | Real end-customer IP (not server IP), for bank anti-fraud. |

```json
{
  "order_ids": [2060, 2061],
  "amount": 15000.00,
  "currency": 398,
  "description": "AMAN AI",
  "client_ip_address": "192.168.1.100"
}
```

## Response — 200 OK

| Field | Type | Description |
|---|---|---|
| `token` | String (UUID) | Payment token. Store it: correlate payment with orders, match callbacks, query status. |
| `url` | String | Bank payment page. **Must redirect the customer here.** One-time URL. |

```json
{ "token": "a1b2c3d4-...", "url": "https://pay.bcc.kz/payment?session=xyz123..." }
```

## Errors

| Status | Condition |
|---|---|
| 400 | Invalid body (e.g. amount ≤ 0) |
| 409 | Same idempotency key still initializing → retry after a short delay |
| 500 | Internal error |
| 502 | Bank gateway error |

## Idempotency

- New key → new payment (`token`+`url`).
- Same key (completed) → returns the cached `token`+`url`.
- Same key (initializing) → `409`, retry later.
- Generate a new UUID v4 per distinct attempt; on network timeout retry with the **same** key.

## Callback / lifecycle (server-side, no action from us)

After the customer pays (or abandons), the bank sends an async callback to the Payment API, which updates order status automatically:
- success → order `PAID_AND_CREATED`
- failure → order `DECLINED`

Payment lifecycle: `PENDING` (waiting) → `APPROVED` (funds captured) or `DECLINED`. The order (via `/profile/orders`) becomes `PAID_AND_CREATED` on success.

**No webhook to us.** We poll `/profile/orders` and read `statusOfOrder` to learn completion.

## Notes

- Redirect to `url` is mandatory; payment won't proceed otherwise.
- `amount` accepts decimals; internally converts to tiyn (1 KZT = 100 tiyn). Dev also said send whole tenge. → we send integer tenge.
- Multiple orders: total `amount` must equal combined order totals.
- Only KZT (`398`) supported.

## Open item (NOT in this doc — product/business)

This pays for **existing `order_ids`**. For an AI balance top-up there is no physical product, so how the top-up order is created (to obtain an `order_id` priced at the top-up amount) is still undefined and is a product/business decision.
