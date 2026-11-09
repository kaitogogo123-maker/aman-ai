# Authentication API Documentation

> Source: client dev. Recorded 2026-06-12. Base `https://aman.kz/api`. Swagger `https://aman.kz/swagger-ui/index.html` (basic auth `swag` / `k4JLR9nK`). All endpoints JSON.

This is the marketplace auth used by tamga (`AUTH_PROVIDER=marketplace`). Our client wrapper: `lib/core/auth/marketplace-client.ts`.

## 1. Registration — 3 steps, same endpoint `POST /authmarket/sign-up`

**Step 1 — request SMS:** body `{ "phone": "+77001234567", "smsCode": "", "fullName": "" }` → `message: "smsCode отправлен"` (or `"Пользователь с таким номером уже существует"` if taken). All `200 OK`, fields may be null.

**Step 2 — verify SMS:** body `{ "phone": "...", "smsCode": "4821", "fullName": "" }` → `message: "Смс код верный"` (correct) / `"Смс код неверный"` (wrong).

**Step 3 — complete:** body includes `phone, fullName, lastName, password (4-20), email, cityId(def 10), filialId, pushToken, pushStatus, presentId, fromWho, regionName, cityName, smsCode:"", username`. Success → `{ accessToken, expiresIn:3600, refreshToken, refreshExpiresIn:2592000, message:"customer создан или обновлен" }`.

## 2. Login — `POST /authmarket/sign-in`

body `{ "phone": "+77001234567", "password": "..." }` → success `{ accessToken, expiresIn:3600, refreshToken, refreshExpiresIn:2592000, message:"success" }`; invalid → `message:"Неверно учетные данные"`, tokens null.

## 3. Forgot password — 3 steps, same endpoint `POST /authmarket/forgot-password` (returns `{ first, second }`)

- Step 1: `{ phone, smsCode:"", password:"" }` → `first:"smsCode отправлен"` (or `"Клиент отсутствует"`).
- Step 2: `{ phone, smsCode:"4821", password:"" }` → `first:"Смс код верный"` / `"Смс код неверный"`.
- Step 3: `{ phone, smsCode:"4821", password:"newPass" }` → `first:"Пароль успешно изменен"`.

## 4. Refresh — `POST /authmarket/refresh`

body `{ "refreshToken": "..." }` → `{ accessToken, expiresIn:3600, refreshToken, refreshExpiresIn:2592000, message:null }`. Both tokens rotate on each call.

## Models & notes

- `JwtAuthenticationResponse` (sign-up/sign-in/refresh): `{ accessToken|null, expiresIn, refreshToken|null, refreshExpiresIn, message }`.
- Forgot-password response: `{ first: string, second: 0 }`.
- **Empty strings, not null** for `smsCode`/`password`/`fullName` when not applicable.
- SMS code = 4 digits (1111–9999).
- Access token = 1h (3600s), refresh = 30d (2592000s).
- `Content-Type: application/json` always; after auth use `Authorization: Bearer {accessToken}`.

### Message reference

`smsCode отправлен` sent · `Смс код верный` correct · `Смс код неверный` wrong · `customer создан или обновлен` created · `Пользователь с таким номером уже существует` phone taken · `Неверно учетные данные` invalid login · `success` login ok · `Клиент отсутствует` customer not found · `Пароль успешно изменен` password changed.
