# REST API reference

Base path: `/api/v1`. JSON is used except `POST /menu/images`, which accepts raw JPEG/PNG/WebP bytes. Zod validates route, query, and body input. Staff and customer cookies are separate; clients send `credentials: include`.

## Common behavior

- Staff scope is derived from the authenticated active membership. With one membership it is selected automatically; the existing selection header can only choose among server-authorized memberships.
- Mutation requests from browsers must carry an exact allowlisted `Origin`.
- Errors use `{ "error": { "code": "...", "message": "...", "details"?: ... } }` and include an `x-request-id` response header.
- Typical statuses: `400` invalid input, `401` unauthenticated/expired, `403` role/origin denial, `404` absent or deliberately hidden cross-scope object, `409` stale version/transition/idempotency/business conflict, `413` oversized image, `415` invalid image type/content, `429` rate limit, `503` failed readiness.
- Order creation/add-item and payment commands require an `Idempotency-Key` header (8–128 trimmed characters). Same key/body returns the recorded result; same key/different body returns `409`.
- List pagination is page-based where exposed: menu items default 24; orders/bills default 20; maximum 100. Kitchen tickets default 50/max 100. Analytics popular items default 5/max 10.

## Authentication and health

| Method/path         | Access                   | Purpose                                            |
| ------------------- | ------------------------ | -------------------------------------------------- |
| `POST /auth/login`  | Public + rate limited    | Verify email/password, create staff session cookie |
| `GET /auth/me`      | Staff session            | Return authenticated user and active memberships   |
| `POST /auth/logout` | Staff session if present | Revoke matching session and clear cookie           |
| `GET /health/live`  | Public                   | Process liveness; no database query                |
| `GET /health/ready` | Public                   | Database-backed readiness, 200/503                 |
| `GET /health`       | Public                   | Compatibility alias for readiness                  |

## Restaurant and staff

| Method/path                                       | Roles          | Purpose                                                              |
| ------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| `GET /restaurants/:restaurantId`                  | Admin, Manager | Read scoped profile/tax settings                                     |
| `PATCH /restaurants/:restaurantId`                | Admin          | Update validated restaurant settings                                 |
| `GET /restaurants/:restaurantId/staff`            | Admin, Manager | List staff; status query supported                                   |
| `POST /restaurants/:restaurantId/staff`           | Admin          | Create user/membership with validated role/password                  |
| `PATCH /restaurants/:restaurantId/staff/:staffId` | Admin          | Update role/status/profile; protects last admin and revokes sessions |

## Menu and images

All routes require a staff session and selected restaurant. Reads are available to active staff; writes require Admin.

| Method/path                                                          | Purpose                                             |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| `GET, POST /menu/categories`                                         | List/create categories                              |
| `PATCH, DELETE /menu/categories/:id`                                 | Update/deactivate category                          |
| `GET, POST /menu/items`                                              | Paginated list/create item                          |
| `GET, PATCH, DELETE /menu/items/:id`                                 | Read/update/deactivate item                         |
| `PATCH /menu/items/:id/availability`                                 | Change item availability                            |
| `PUT /menu/items/:id/modifier-groups`                                | Replace validated group assignments                 |
| `GET, POST /menu/modifier-groups`                                    | List/create groups                                  |
| `PATCH, DELETE /menu/modifier-groups/:id`                            | Update/deactivate group                             |
| `POST /menu/modifier-groups/:groupId/modifiers`                      | Add modifier                                        |
| `PATCH, DELETE /menu/modifier-groups/:groupId/modifiers/:modifierId` | Update/deactivate modifier                          |
| `POST /menu/images`                                                  | Admin raw image upload, max 3 MB, signature checked |

`DELETE` menu operations are archival/deactivation, not physical deletion. Image responses contain a stable relative local reference or HTTPS Cloudinary URL.

## Tables and sessions

| Method/path                      | Roles                           | Purpose                                           |
| -------------------------------- | ------------------------------- | ------------------------------------------------- |
| `GET /tables`, `GET /tables/:id` | All staff roles                 | List/read scoped tables; occupancy filter on list |
| `POST /tables`                   | Admin                           | Create a table with server QR identifier          |
| `PATCH /tables/:id`              | Admin, Manager                  | Update allowed table fields/status                |
| `DELETE /tables/:id`             | Admin                           | Deactivate when business rules allow              |
| `POST /tables/:id/sessions`      | Admin, Manager, Waiter          | Open one concurrency-safe session                 |
| `GET /tables/:id/sessions`       | Admin, Manager, Waiter          | Read session history                              |
| `GET /table-sessions/:id`        | Admin, Manager, Waiter, Cashier | Read a session                                    |
| `POST /table-sessions/:id/close` | Admin, Manager, Waiter, Cashier | Close only when orders/billing are resolved       |
| `GET /tables/:id/qr`             | Admin                           | Return current QR payload/image data              |
| `POST /tables/:id/qr/rotate`     | Admin                           | Replace identifier and invalidate old QR          |

## Staff orders and kitchen

| Method/path                                        | Roles                           | Purpose                                                  |
| -------------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `POST /orders`                                     | Admin, Manager, Waiter          | Transactional priced order; idempotency key required     |
| `GET /orders`                                      | All staff roles                 | Paginated restaurant order list                          |
| `GET /orders/:id`                                  | All staff roles                 | Read one scoped order                                    |
| `POST /orders/:id/items`                           | Admin, Manager, Waiter          | Append a snapshot batch; idempotency key required        |
| `PATCH /orders/:id/status`                         | Admin, Manager, Waiter, Kitchen | Versioned policy-controlled transition                   |
| `GET /orders/:id/history`                          | All staff roles                 | Order and item audit history                             |
| `GET /kitchen/tickets`, `GET /kitchen/tickets/:id` | Admin, Manager, Kitchen         | Read active/scoped kitchen work                          |
| `PATCH /kitchen/orders/:id/status`                 | Admin, Manager, Kitchen         | Kitchen order transition                                 |
| `PATCH /kitchen/items/:id/status`                  | Admin, Manager, Kitchen         | Version-aware item transition and aggregate order update |

Normal order flow is `PENDING -> ACCEPTED -> PREPARING -> READY -> SERVED`; cancellation/rejection are policy-controlled terminal alternatives. Stale versions and invalid transitions return conflicts.

## Public customer ordering

| Method/path                                | Access                        | Purpose                                             |
| ------------------------------------------ | ----------------------------- | --------------------------------------------------- |
| `GET /public/tables/:identifier`           | Public                        | Resolve active QR table presentation data           |
| `GET /public/tables/:identifier/menu`      | Public                        | Read filtered effective public menu                 |
| `POST /public/table-access/activate`       | Public + origin/rate limit    | Consume staff code and set customer cookie          |
| `GET /public/customer-session`             | Customer session              | Restore bound session                               |
| `POST /public/customer-session/logout`     | Customer session if present   | Revoke/clear customer cookie                        |
| `POST /public/orders`                      | Customer session + rate limit | Transactional owned order; idempotency key required |
| `GET /public/orders`                       | Customer session              | List only orders created by this session            |
| `GET /public/orders/:id`                   | Owning customer session       | Read owned order; foreign order is hidden           |
| `POST /table-sessions/:id/customer-access` | Admin, Manager, Waiter        | Issue/replace a short-lived activation code         |

## Billing and payments

| Method/path                                | Roles                           | Purpose                                                   |
| ------------------------------------------ | ------------------------------- | --------------------------------------------------------- |
| `GET /billing/active-sessions`             | Admin, Manager, Cashier, Waiter | Sessions relevant to billing                              |
| `GET /table-sessions/:id/bill-preview`     | Admin, Manager, Cashier, Waiter | Authoritative preview before finalization                 |
| `POST /table-sessions/:id/bills`           | Admin, Manager, Cashier         | Transactionally finalize one immutable bill               |
| `GET /table-sessions/:id/bill`             | Admin, Manager, Cashier, Waiter | Read session bill                                         |
| `GET /bills`                               | Admin, Manager, Cashier         | Paginated finalized bill list                             |
| `GET /bills/:id`, `GET /bills/:id/receipt` | Admin, Manager, Cashier         | Bill detail/printable snapshot                            |
| `GET /bills/:id/payments`                  | Admin, Manager, Cashier         | List manual payment records                               |
| `POST /bills/:id/payments`                 | Admin, Manager, Cashier         | Record positive cash/UPI amount; idempotency key required |

Concurrent payment attempts lock the bill and cannot exceed the outstanding amount. UPI is manually recorded and not gateway verified.

## Analytics

All analytics endpoints require Admin or Manager and validated restaurant-local date range query values.

`GET /analytics/overview`, `/sales`, `/payments`, `/popular-items`, `/orders`, `/tables`, and `/kitchen` return separate aggregate views. Sales are finalized bill values; payments are recorded collections; outstanding balances remain distinct.

## Realtime events

Socket.IO uses the API origin and HTTP-only cookies. Staff send `realtime:subscribe` for one allowed `restaurant`, `kitchen`, or `waiters` channel; customers send `customer:subscribe` for an order they own. Server events are `order:changed`, `bill:changed`, and `customer:order-changed`. Events are minimal invalidations with IDs/version metadata. Clients deduplicate and refetch REST after connect/reconnect/event.
