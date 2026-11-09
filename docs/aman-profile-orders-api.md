# Profile Orders API

> Source: client dev. Recorded 2026-06-12.

## Endpoint

```
GET {BASE_URL}/profile/orders
```

Base: `https://aman.kz/api`.

## Description

Returns the authenticated customer's orders for "My Profile -> Orders". The customer is detected from the JWT token; the frontend does NOT send `customerId`. Backend returns only that customer's orders.

## Authentication

Required: `Authorization: Bearer {accessToken}`

## Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `country` | string | yes | `kz` = Kazakhstan/local product orders; `ch` = Chinese product orders |
| `page` | integer | no | Zero-based page number |
| `size` | integer | no | Page size |
| `sort` | string | no | Spring pageable sort, e.g. `createdDate,desc` |

`country=ch` → orders linked to Chinese products (`productCh` not empty), mapped into `productChDTO`. `country=kz` → local orders, read `productDTO`.

## Success — 200 OK, `Page<OrderDTO>`

```json
{
  "content": [
    {
      "id": 123, "customerId": 45, "orderPrice": 25000,
      "deliveryAddress": "...", "productId": 789, "comment": "...", "actual": true,
      "productDTO": null,
      "productChDTO": { "id": 789, "name": "Chinese product name" },
      "productPrice": 25000,
      "filialDTO": { "id": 1, "name": "Filial name" },
      "statusOfOrder": "CREATED",
      "statusDate": "2026-06-09T10:00:00.000+00:00",
      "amountOfProduct": 1, "photoUrl": [], "paymentId": 1001, "trackCode": "TRACK123"
    }
  ],
  "pageable": { "pageNumber": 0, "pageSize": 10 },
  "totalElements": 1, "totalPages": 1, "last": true, "first": true,
  "size": 10, "number": 0, "numberOfElements": 1, "empty": false
}
```

Empty → 200 with `content: []`, `empty: true`. Error 400 (e.g. invalid token user id) → `{ "content": [], "empty": true }`.

## statusOfOrder enum (full, from dev 2026-06-12)

| Value | Meaning |
|---|---|
| `IN_PROGRESS` ("init") | waiting for payment |
| `NEW` ("new") | new payment |
| `PENDING` ("pending") | waiting for payment |
| `APPROVED` ("approved") | payment successfully confirmed |
| `DECLINED` ("declined") | payment declined |
| `PAID_AND_CREATED` ("paid and created") | payment successfully confirmed |
| `EXPIRED` ("expired") | payment archived |

Paid = `APPROVED` or `PAID_AND_CREATED`. Failed = `DECLINED`. Expired = `EXPIRED`. (For crediting we use the terminal `PAID_AND_CREATED`; see PAYMENT_INTEGRATION.md.)

## Frontend notes

- ch tab: `GET /profile/orders?country=ch&page=0&size=10` → read `productChDTO`.
- kz tab: `GET /profile/orders?country=kz&page=0&size=10` → read `productDTO`.

Swagger: `https://aman.kz/swagger-ui/index.html` (basic auth `swag` / `k4JLR9nK`).
