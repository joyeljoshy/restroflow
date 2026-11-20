# RestroFlow

RestroFlow is a production-minded restaurant operations platform built as a TypeScript monorepo. Parts 1 through 10 provide the application shell, API foundation, PostgreSQL/Prisma connectivity, shared contracts, secure staff authentication, role-based restaurant access, restaurant settings, staff account management, menu management, restaurant tables and sessions, secure table QR management, transactional staff and customer ordering, a waiter POS, a real-time Kitchen Display System, immutable billing with manual cash/UPI payment recording, and restaurant-scoped operational analytics. Inventory, refunds, and gateway settlement are intentionally not implemented yet.

## Architecture

```text
apps/
  web/        Next.js App Router UI and role workspace shells
  api/        Express modular monolith and Prisma access
packages/
  contracts/  Framework-neutral TypeScript types and Zod schemas
```

PostgreSQL is the source of truth. The API owns database access and exposes versioned REST endpoints. The web app consumes shared runtime contracts from `@restroflow/contracts`. See [AGENTS.md](./AGENTS.md) for the engineering rules.

## Prerequisites

- Node.js 24 LTS and npm 11
- Docker Desktop with Docker Compose
- Git

## Local setup

1. Install all workspace dependencies from the repository root:

   ```bash
   npm install
   ```

2. Create local environment files:

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item apps/api/.env.example apps/api/.env
   ```

   macOS/Linux:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

3. Replace `replace_with_a_local_password` in both files with the same local-only password. Do not commit either `.env` file.

4. Start PostgreSQL and wait for it to become healthy:

   ```bash
   docker compose up -d postgres
   docker compose ps
   ```

5. Generate Prisma Client and verify the database connection:

   ```bash
   npm run db:generate
   npm run db:seed
   ```

   The Part 1 seed is intentionally non-destructive: it verifies connectivity and writes no domain data.

6. Start both applications:

   ```bash
   npm run dev
   ```

   - Web: http://localhost:3000
   - API health: http://localhost:4000/api/v1/health

The health endpoint returns HTTP `200` when PostgreSQL is reachable and `503` with a degraded status when it is not.

## Environment variables

API variables live in `apps/api/.env`:

| Variable               | Purpose                                      | Example                     |
| ---------------------- | -------------------------------------------- | --------------------------- |
| `NODE_ENV`             | Runtime mode                                 | `development`               |
| `PORT`                 | API port                                     | `4000`                      |
| `LOG_LEVEL`            | Pino log level                               | `info`                      |
| `CORS_ORIGINS`         | Comma-separated trusted web origins          | `http://localhost:3000`     |
| `PUBLIC_WEB_ORIGIN`    | Public web origin embedded in table QR codes | `http://localhost:3000`     |
| `DATABASE_URL`         | Server-only PostgreSQL connection URL        | See `apps/api/.env.example` |
| `MENU_IMAGE_DIRECTORY` | Local menu image directory for development   | `uploads/menu`              |

To point the browser at a non-default API, set `NEXT_PUBLIC_API_URL` for the web workspace. Never place credentials in a `NEXT_PUBLIC_*` variable.

## Commands

| Command                                          | Description                                   |
| ------------------------------------------------ | --------------------------------------------- |
| `npm run dev`                                    | Run web and API development servers           |
| `npm run build`                                  | Build all workspaces                          |
| `npm run lint`                                   | Lint all workspaces                           |
| `npm run typecheck`                              | Type-check all workspaces                     |
| `npm test`                                       | Run Vitest and Supertest suites               |
| `npm run test:e2e`                               | Run Playwright tests (install Chromium first) |
| `npm run format`                                 | Format tracked source files                   |
| `npm run format:check`                           | Check formatting                              |
| `npm run db:generate`                            | Generate Prisma Client                        |
| `npm run db:migrate -- --name <name>`            | Create and apply a development migration      |
| `npm run db:migrate:deploy`                      | Apply committed migrations in deployment      |
| `npm run db:seed`                                | Run the explicit safe seed script             |
| `npm run db:studio`                              | Open Prisma Studio                            |
| `npm run benchmark:analytics -w @restroflow/api` | Run the isolated analytics query benchmark    |

Install the Playwright browser once before local end-to-end tests:

```bash
npx playwright install chromium
```

## Migration workflow

1. Change `apps/api/prisma/schema.prisma` as part of a requested feature.
2. Run `npm run db:migrate -- --name descriptive_name` against local PostgreSQL.
3. Review and commit the generated SQL under `apps/api/prisma/migrations`.
4. Regenerate the client and run lint, type checking, and tests.
5. Deploy with `npm run db:migrate:deploy`; never use `db push` for production changes.

The committed migrations define secure staff identity and the restaurant profile, contact, locale, currency, and integer-basis-point tax settings used by Part 3.

## Staff authentication

Staff authenticate through `POST /api/v1/auth/login`. The API verifies the password with Argon2id, creates a cryptographically random opaque session token, stores only its SHA-256 hash, and returns the raw token in an HTTP-only, SameSite cookie. Production cookies also use `Secure`.

The browser restores authentication with `GET /api/v1/auth/me`. Protected layouts wait for that authoritative response before rendering. `POST /api/v1/auth/logout` revokes the matching server-side session and clears the cookie. Expired, revoked, inactive-user, and membership-less sessions are rejected and cleared.

Authorization is enforced by Express in this order:

1. `requireAuth` loads the user and active memberships from the server-side session.
2. `requireRestaurantAccess` matches the route restaurant to those memberships.
3. `requireRole` checks the role on the verified membership.

Client-provided role or restaurant values never establish permission. Customers are not staff users and will use a separate public ordering flow.

## Restaurant and staff management

Admins can manage restaurant settings at `/admin/settings` and staff accounts at `/admin/staff`. Managers have read-only access to these views. The API scopes every operation through the authenticated restaurant membership; only admins can update settings or create, edit, activate, deactivate, and change staff roles.

Deactivating a staff membership or changing its role revokes that user's active sessions. The last active admin cannot be demoted or deactivated. Tax rates are stored as integer basis points, and account responses never include password hashes or session tokens.

Login attempts are rate-limited per source address. All login inputs use the shared Zod contract, and failures return the same invalid-credentials response to avoid account disclosure.

## Menu management

Administrators manage categories, items, availability, modifier groups, and modifier options at `/admin/menu`. Managers retain read-only access under the established permission model. Waiter, kitchen, and cashier API reads are restricted to active, effectively available items. Internal menu endpoints resolve restaurant scope from an authenticated membership; the optional `x-restaurant-id` header only selects among memberships already authorized by the server.

Menu prices and modifier surcharges are integer minor units. Categories, items, and modifier groups are deactivated instead of physically deleted. Deactivating a category leaves its items intact but makes them effectively unavailable. Item ordering is deterministic by category order, item order, name, and ID. The Part 4 public menu schema deliberately excludes internal lifecycle fields, but no public QR route or ordering workflow is implemented yet.

Authenticated menu endpoints are mounted under `/api/v1/menu`:

- `GET|POST /categories`, `PATCH|DELETE /categories/:id`
- `GET|POST /items`, `GET|PATCH|DELETE /items/:id`
- `PATCH /items/:id/availability`
- `PUT /items/:id/modifier-groups`
- `GET|POST /modifier-groups`, `PATCH|DELETE /modifier-groups/:id`
- `POST /modifier-groups/:groupId/modifiers`
- `PATCH|DELETE /modifier-groups/:groupId/modifiers/:modifierId`
- `POST /images`

The image endpoint accepts raw JPEG, PNG, or WebP files up to 3 MB and stores only a generated stable reference in PostgreSQL. The default local filesystem adapter is development-safe: filenames are server-generated UUIDs and paths are never taken from the client. Local files are not durable across ephemeral or multi-instance deployments, so production deployments must mount persistent shared storage or replace this adapter with object storage before relying on uploads. No cloud credentials are included or inferred.

## Table and QR management

Administrators manage tables at `/admin/tables`; managers can view tables and change permitted operational states. Waiters use `/waiter/tables` to see live availability and open or close dining sessions. Kitchen access is read-only, while cashiers can view active sessions through the API.

Occupancy is derived from an open `TableSession`; it is not stored as a second mutable state. PostgreSQL enforces one open session per table with a partial unique index, and session status/date constraints keep open and closed records consistent. Tables are taken out of service instead of deleted, and closed sessions remain historical records.

Authenticated table endpoints are mounted directly under `/api/v1`:

- `GET|POST /tables`, `GET|PATCH|DELETE /tables/:id`
- `POST|GET /tables/:id/sessions`
- `GET /table-sessions/:id`, `POST /table-sessions/:id/close`
- `GET /tables/:id/qr`, `POST /tables/:id/qr/rotate`

Each table has a cryptographically random QR identifier. Rotating it immediately replaces the stored identifier, invalidating earlier codes. QR payloads point at `/menu/table/:identifier`. A QR identifies a table and opens its filtered public menu; it never authorizes an order by itself.

## Customer QR ordering

Customers browse the mobile-first menu at `/menu/table/:identifier`. An active table session and a separate six-digit code issued by an admin, manager, or waiter are required before ordering. Codes are generated with a cryptographically secure random source, Argon2id-hashed, single-use, valid for ten minutes, and locked after five failed attempts. API-level rate limiting adds a source-address bound around verification attempts.

Successful activation creates a separate four-hour customer ordering session. Its opaque token is stored only as a SHA-256 hash and sent in an HTTP-only, SameSite cookie (also `Secure` in production). The session is bound to one restaurant and one open table session, is revocable, and becomes invalid as soon as the restaurant/table is inactive or the table session closes. It never grants staff API access.

Public endpoints are mounted under `/api/v1/public`:

- `GET /tables/:identifier` and `GET /tables/:identifier/menu`
- `POST /table-access/activate`
- `GET /customer-session` and `POST /customer-session/logout`
- `POST|GET /orders` and `GET /orders/:id`

Staff issue or rotate a code with `POST /api/v1/table-sessions/:id/customer-access`. Customer submissions reuse the same transactional pricing, availability, modifier, immutable-snapshot, and post-commit kitchen event path as waiter orders. Customer idempotency keys are scoped to the customer session, so retrying the same payload returns the original order while a conflicting payload returns `409`.

Customer order visibility is intentionally session-specific: a session may read and subscribe only to orders it created. A second customer session at the same table does not inherit those orders. Customer sockets authenticate separately, verify order ownership before joining a `customer-session:{id}` room, receive only minimal `customer:order-changed` invalidations, and refetch authoritative REST state after events and reconnects. Staff restaurant/kitchen/waiter rooms remain unchanged.

MVP security limitation: a staff-provided short code is proof of staff-mediated activation, not strong proof of physical presence. A nearby person could relay it before use, and source-IP limits are imperfect behind shared networks or distributed attackers. Codes are therefore short-lived, one-time, attempt-bounded, and replaceable. Higher-assurance deployments can later add staff device approval or rotating proximity challenges without placing bearer credentials in QR codes.

## Transactional orders and waiter POS

Waiters use `/waiter/pos` to select an open table session, browse the effectively available menu, configure modifiers, build a temporary cart, submit an order, inspect table order history, and add immutable item batches. TanStack Query owns authoritative menu, table, and order state; the Zustand cart contains draft UI state only.

The API calculates every price from PostgreSQL and stores immutable item and modifier snapshots in integer minor units. Order creation and add-items commands require an `Idempotency-Key` header scoped to the restaurant and staff membership. A repeated key with the same request returns the stored response; a different request returns `409`. Status and add-item mutations use compare-and-increment order versions to prevent lost updates.

Part 6 staff order endpoints are mounted under `/api/v1`:

- `POST|GET /orders`
- `GET /orders/:id`
- `POST /orders/:id/items`
- `PATCH /orders/:id/status`
- `GET /orders/:id/history`

Orders normally move through `PENDING → ACCEPTED → PREPARING → READY → SERVED`. Kitchen item changes are audited and aggregated transactionally: all pending active items keep an accepted order at `ACCEPTED`, any preparing/ready mix produces `PREPARING`, and all active items ready produces `READY`. Cancelled items do not block readiness; an order with no active items becomes cancelled. `SERVED`, `CANCELLED`, and `REJECTED` are terminal. Waiters can serve ready orders and can cancel only pending or accepted orders. A table session cannot close while an order is `PENDING`, `ACCEPTED`, `PREPARING`, or `READY`.

## Kitchen display and real-time synchronization

Kitchen staff use `/kitchen` to view bounded, oldest-first tickets in New, Preparing, and Ready columns. Tickets render immutable item/modifier snapshots, instructions, batches, preparation age, and item status. Large touch actions accept or reject intake, start an entire ticket or one item, and mark items ready. Optional audio notifications require an explicit user action.

Kitchen HTTP endpoints are mounted under `/api/v1/kitchen`:

- `GET /tickets` and `GET /tickets/:id`
- `PATCH /orders/:id/status`
- `PATCH /items/:id/status`

Order versions protect both order and item commands. Adding a batch to a ready order preserves earlier ready items, creates pending items in the next immutable batch, and moves the aggregate order back to preparing. Related item changes, aggregate order changes, versions, and histories commit in one PostgreSQL transaction.

Socket.IO shares the API HTTP server and authenticates the same HTTP-only staff session cookie. Clients request only a channel name; the server derives and verifies the restaurant from the session before joining `restaurant:{restaurantId}:restaurant`, `restaurant:{restaurantId}:kitchen`, or `restaurant:{restaurantId}:waiters`. Kitchen rooms allow admin, manager, and kitchen roles; waiter rooms allow admin, manager, and waiter roles. Connections are periodically revalidated so revoked sessions, deactivated accounts, and role changes are disconnected.

The server publishes a minimal versioned `order:changed` invalidation only after a successful transaction commits. An idempotent replay does not publish again. REST remains authoritative: clients deduplicate event IDs/versions, refetch after events and reconnects, and periodically reconcile the KDS. This MVP intentionally uses post-commit publication instead of an outbox, so a process failure in the narrow interval after commit can lose a notification; reconnect and periodic REST reads recover the state.

## Billing and manual payment recording

Administrators, managers, and cashiers use `/cashier` to review active table sessions, preview server-calculated bills, finalize immutable financial snapshots, record partial or full cash/UPI payments, print browser receipts, search history, and close fully paid sessions. Waiters may see limited live billing status and previews but cannot finalize bills or record payments. Kitchen and public customer sessions have no billing access.

Only served orders are billable. Cancelled/rejected orders and cancelled items are excluded, while any unresolved order blocks finalization. Finalization locks the table session and its orders, and the order submission path uses the same session lock; once a bill exists, no later order or item batch can enter that session. PostgreSQL also enforces one bill per session and one bill item per source order item.

Tax uses the restaurant's configured basis-point rate and inclusion mode. The API performs integer-only, half-up rounding per bill line (`PER_LINE_HALF_UP_V1`). For tax-exclusive menus, line tax is added to the payable total. For tax-inclusive menus, the tax component is extracted without increasing the displayed item total. Final bills snapshot the currency, tax name, rate, inclusion mode, computed tax, and rounding policy, so later settings changes do not rewrite history. These configurable calculations require jurisdiction-specific review before commercial tax use.

Cash and UPI are manual records only. RestroFlow does not collect money, query a bank, or verify a UPI transfer. Each payment requires explicit staff confirmation and an actor-scoped `Idempotency-Key`; identical retries return the stored response, conflicting reuse returns `409`, and bill row locks prevent concurrent overpayment. Refunds, reversals, payment gateways, webhooks, and customer-by-customer split billing are outside Part 9.

Billing endpoints are mounted under `/api/v1`:

- `GET /billing/active-sessions`
- `GET /table-sessions/:id/bill-preview`
- `POST /table-sessions/:id/bills`
- `GET /table-sessions/:id/bill`
- `GET /bills` and `GET /bills/:id`
- `GET /bills/:id/receipt`
- `GET|POST /bills/:id/payments`

`POST /table-sessions/:id/bills` performs creation and finalization as one atomic operation; a mutable persisted draft endpoint is intentionally omitted. A table session containing served items can close only after every eligible item is represented in its fully paid bill. Sessions containing no billable items may still close after all orders resolve.

## Restaurant analytics

Administrators and managers use `/admin/analytics`; cashier, waiter, kitchen, and customer identities cannot access the analytics API. The client-supplied `x-restaurant-id` only selects one of the authenticated user's memberships, and every repository query applies the resulting server-derived restaurant ID.

Analytics endpoints are mounted under `/api/v1/analytics`:

- `GET /overview`
- `GET /sales`
- `GET /payments`
- `GET /popular-items`
- `GET /orders`
- `GET /tables`
- `GET /kitchen`

Every endpoint accepts `startDate`, `endDate`, and `granularity=day|week|month`; popular items also accepts a bounded `limit`. Dates are restaurant-local calendar dates using an inclusive start and exclusive end. PostgreSQL converts each local midnight through the restaurant's IANA timezone and then into the UTC representation stored by Prisma. This handles non-UTC restaurants, midnight records, and daylight-saving days without consulting the Node.js host timezone. Ranges are limited to 366 days.

### Metric definitions

| Metric                              | Source and event timestamp                                   | Formula and status policy                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalized sales                     | `Bill.totalMinor`, `Bill.finalizedAt`                        | Sum immutable totals for all persisted finalized-lifecycle bills in `[start, end)`; bills remain included when later partially or fully paid.                                                                              |
| Recorded payments                   | `Payment.amountMinor`, `Payment.recordedAt`                  | Sum `RECORDED` cash/UPI rows in `[start, end)`; UPI is staff-recorded, not provider-settled.                                                                                                                               |
| Current outstanding                 | Current `Bill` rows                                          | Sum `totalMinor - amountPaidMinor` for `FINALIZED` and `PARTIALLY_PAID` bills across all dates.                                                                                                                            |
| Period outstanding                  | `Bill.finalizedAt` plus current balance                      | The same remaining-balance formula, restricted to bills finalized in `[start, end)`.                                                                                                                                       |
| Average bill value                  | `Bill.totalMinor`, `Bill.finalizedAt`                        | Finalized sales divided by finalized bill count, rounded to the nearest minor unit; zero when no bills exist.                                                                                                              |
| Orders created/source               | `Order.createdAt`                                            | Count order records once, so add-item batches do not inflate order volume.                                                                                                                                                 |
| Completed/cancelled/rejected orders | `OrderStatusHistory.createdAt`                               | Count distinct order IDs by the corresponding terminal transition in `[start, end)`.                                                                                                                                       |
| Popular items                       | `BillItem` snapshots joined to source `OrderItem.menuItemId` | Sum snapshot quantity and `finalLineAmountMinor`; group by stable menu-item identity and use the latest in-range snapshot name.                                                                                            |
| Table duration                      | `TableSession.openedAt`/`closedAt`                           | Average valid closed-session duration for sessions closed in `[start, end)`; open sessions are excluded. No occupancy percentage is inferred.                                                                              |
| Kitchen duration                    | `OrderItemStatusHistory.createdAt`                           | For non-cancelled items/orders with ordered `PENDING → PREPARING → READY` events, report queue, preparation, and total-to-ready averages by ready time. Missing transitions are excluded and the sample count is returned. |

Money remains integer minor units in PostgreSQL. Aggregates cross the wire as decimal strings so values above JavaScript's safe-integer range are not rounded; the UI formats them with `BigInt`. Charts are withheld if a value cannot be represented exactly by the chart library, while exact KPI values remain visible. Analytics never writes to bills, payments, orders, sessions, or histories.

The migration adds restaurant/event-time indexes for bill finalization, payment recording, order creation, and table-session closure. Existing status-history indexes serve order and kitchen reports. Run `npm run benchmark:analytics -w @restroflow/api` for a repeatable benchmark: it creates a uniquely scoped 500-row restaurant fixture, warms and samples the overview, sales, payments, and popular-items queries five times, prints medians, and deletes only that fixture in a `finally` block.

### Create the first development admin

The seed remains a read-only connectivity check unless every `ADMIN_SEED_*` variable is supplied. Admin creation is refused when `NODE_ENV=production`.

PowerShell example:

```powershell
$env:ADMIN_SEED_EMAIL = "admin@example.com"
$env:ADMIN_SEED_PASSWORD = "use-a-long-local-password"
$env:ADMIN_SEED_NAME = "Local Admin"
$env:ADMIN_SEED_RESTAURANT_SLUG = "local-restaurant"
$env:ADMIN_SEED_RESTAURANT_NAME = "Local Restaurant"
npm run db:seed
```

The operation is transactional and repeatable. Re-running it intentionally refreshes that development user's name, password, active state, and admin membership. Clear the temporary shell variables afterward. Never use this workflow for production account provisioning.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

For a manual smoke test, sign in as the development admin, update and reload `/admin/settings`, then create, edit, deactivate, and reactivate a non-admin account in `/admin/staff`. Open `/admin/menu`, create a category, add an item, assign a modifier group, upload an image, change availability, and reload to confirm persistence. At `/admin/tables`, create and edit a table, open a session, inspect its history, download or print its QR, and rotate the code. In one browser, sign in as a waiter at `/waiter/pos`; in another, sign in as kitchen staff at `/kitchen`. Submit an order and confirm the ticket appears without refreshing. Accept it, start preparation, mark items ready, and verify the waiter status updates. Mark it served from the POS. Repeat with a second batch added after the first is ready and confirm the first batch remains ready while the order returns to preparing. Briefly take one browser offline, change the order from the other, reconnect, and confirm authoritative state recovers. Confirm the table session cannot close until all orders are served, cancelled, or rejected.

For the customer flow, keep the waiter and kitchen browsers open and scan/open the table QR in a third private browser. Browse and customize an item, then use **Customer code** on the waiter table card to issue a code. Activate, submit, and confirm the CUSTOMER ticket appears in the existing KDS. Move it through preparation and verify the customer tracker updates. Open the same QR in a fourth private browser, issue a separate code, and confirm it cannot read the first customer's order. Rotate the QR and confirm the old URL returns unavailable.

For billing, serve every active order, sign in as a cashier, open `/cashier`, select the occupied table, verify the preview and tax breakdown, and finalize. Record a partial cash amount, then the remaining amount as manually confirmed UPI; verify the receipt shows both records and a zero outstanding balance. Print the receipt and close the table. Confirm an unpaid bill cannot close, a waiter cannot record payment, an overpayment is rejected, and retrying the same request with one idempotency key does not create another payment. Closing the session should invalidate its customer REST and realtime access. Check phone, tablet, keyboard, offline/reconnect, and page-reload behavior, then call the health endpoint and verify `checks.database` is `up`.

## Stopping local services

```bash
docker compose down
```

The named database volume is retained. Use `docker compose down --volumes` only when you intentionally want to delete all local RestroFlow database data.
