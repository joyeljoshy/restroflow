# RestroFlow

RestroFlow is a full-stack restaurant operations portfolio project that connects staff ordering, customer QR ordering, kitchen preparation, billing, and analytics around one PostgreSQL source of truth. It is implemented as a strict TypeScript monorepo with a Next.js frontend, an Express/Socket.IO API, Prisma, transactional business rules, role-based access control, and automated browser/API coverage.

> Deployment status: locally prepared, not yet deployed. No live URL or public credentials are published until the separate deployment approval and verification stage.

## What the project demonstrates

- Staff authentication with opaque HTTP-only sessions and Argon2id password hashes.
- Restaurant-scoped RBAC for admin, manager, waiter, kitchen, and cashier roles.
- Menu, modifier, staff, restaurant, and table administration.
- Rotatable table QR identifiers and separately authenticated customer ordering sessions.
- Transactional waiter/customer orders with server-side pricing, immutable snapshots, and idempotency keys.
- Optimistic concurrency and database row locking around order, bill, payment, and table-session changes.
- A realtime Kitchen Display System using minimal Socket.IO invalidations plus REST reconciliation.
- Immutable finalized bills, integer-minor-unit tax calculations, partial payments, and manually recorded cash/UPI payments.
- Restaurant-timezone analytics for sales, payments, orders, tables, popular items, and kitchen timing.
- Deliberate loading, empty, error, reconnect, keyboard, focus, contrast, and reduced-motion states.

UPI entries are operational records only. RestroFlow does not integrate a payment gateway or claim external payment verification.

## Users and workflows

| Role     | Primary capabilities                                                   |
| -------- | ---------------------------------------------------------------------- |
| Admin    | Restaurant settings, staff, menu, tables, all operational views        |
| Manager  | Read management data and supervise restaurant operations               |
| Waiter   | Open tables, issue customer activation codes, place and serve orders   |
| Kitchen  | Read scoped tickets and update order/item preparation states           |
| Cashier  | Finalize bills, record manual payments, issue receipts, close sessions |
| Customer | Browse a QR menu, activate table access, order, and track owned orders |

Typical lifecycle:

```text
Table session opens
  -> waiter or customer submits an idempotent order
  -> kitchen advances item preparation
  -> waiter serves completed items
  -> cashier finalizes an immutable bill
  -> cashier records cash/UPI payment
  -> fully paid table session closes
  -> analytics reads finalized operational history
```

## Architecture

```text
apps/web                 Next.js App Router UI
    | HTTPS + credentials                 | WSS/Socket.IO
    v                                      v
apps/api                 Express modular monolith + one HTTP server
    | Prisma 7 / PostgreSQL adapter        | authenticated image upload
    v                                      v
PostgreSQL               authoritative state       Cloudinary (production)

packages/contracts       shared framework-neutral Zod wire schemas/types
```

The API is divided into routes, controllers, services, repositories, and validation schemas. Services own authorization orchestration and transaction boundaries; repositories own persistence; shared contracts contain wire-level Zod schemas without database or UI details. REST remains authoritative, while Socket.IO tells subscribed clients which state to refetch.

See [architecture](./docs/architecture.md), [security](./docs/security.md), [database design](./docs/database.md), and [API reference](./docs/api.md).

## Technology stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Zustand, React Hook Form, Zod, Recharts, shadcn-style primitives.
- Backend: Node.js 24, Express 5, Socket.IO, Pino, Helmet, Argon2id, Zod.
- Data: PostgreSQL 17, Prisma 7 with `@prisma/adapter-pg`.
- Testing: Vitest, Supertest, Playwright, axe-core, real-PostgreSQL opt-in journeys, load/analytics harnesses.
- Delivery target: Vercel Hobby, Render Free, Neon Free, Cloudinary Free, GitHub Actions.

## Local development

Prerequisites: Node.js 24, npm 11, Docker Desktop/Compose, and Git.

```powershell
npm install
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Replace the local PostgreSQL password placeholders in `.env` and `apps/api/.env` with the same local-only value. The default seed verifies connectivity and performs no writes unless all optional development-admin variables are supplied.

- Web: `http://localhost:3000`
- API liveness: `http://localhost:4000/api/v1/health/live`
- API readiness: `http://localhost:4000/api/v1/health/ready`

Never commit `.env` files. `NEXT_PUBLIC_API_URL` is public by design; database, session, seed, and Cloudinary secrets must never use the `NEXT_PUBLIC_` prefix.

## Commands

| Command                               | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| `npm run dev`                         | Start the web and API development servers          |
| `npm run build`                       | Build contracts, API, and web production artifacts |
| `npm run format:check`                | Verify Prettier formatting                         |
| `npm run lint`                        | Run workspace ESLint checks                        |
| `npm run typecheck`                   | Run strict TypeScript and Prisma generation checks |
| `npm test`                            | Run workspace unit/integration tests               |
| `npm run test:e2e`                    | Run standard Playwright journeys                   |
| `npm run db:generate`                 | Generate the Prisma client                         |
| `npm run db:migrate -- --name <name>` | Create a local development migration               |
| `npm run db:migrate:deploy`           | Apply reviewed committed migrations                |
| `npm run db:seed`                     | Connectivity check / optional local admin seed     |
| `npm run db:seed:demo`                | Explicit, guarded synthetic demo fixture           |
| `npm run load:test`                   | Run the isolated local API load harness            |

Production uses reviewed `prisma migrate deploy`; it never uses `migrate reset`, destructive `db push`, or automatic migrations in API startup. The safe Neon workflow and approval gate are documented in [deployment.md](./docs/deployment.md).

## Testing and evidence

CI runs on Linux with PostgreSQL 17 and executes dependency installation, Prisma generation, all committed migrations, formatting, lint, strict types, unit/integration tests, production builds, Chromium installation, and Playwright.

Part 11 historically reported 153 unit/integration tests and 27 Playwright tests passing. Those numbers are historical evidence, not a claim about the current worktree; current Part 12 results are recorded in [testing.md](./docs/testing.md) after verification. Measured local benchmark evidence and limitations remain in [part-11-hardening-report.md](./docs/part-11-hardening-report.md).

## Deployment posture

Part 12 prepares a zero-monthly-cost personal portfolio deployment:

| Boundary     | Target                  | Important constraint                                              |
| ------------ | ----------------------- | ----------------------------------------------------------------- |
| Web          | Vercel Hobby            | Personal/non-commercial portfolio use only                        |
| API/realtime | Render Free Web Service | Sleeps when idle; cold starts; one instance; ephemeral filesystem |
| Database     | Neon Free PostgreSQL    | Pooled runtime URL, direct migration URL, TLS required            |
| Images       | Cloudinary Free         | Authenticated server uploads; quota and orphan cleanup monitoring |
| CI/source    | GitHub Free             | Validation only; no production migration in pull requests         |

No cloud resource has been provisioned by this repository change. Exact settings, environment variables, limitations, and approval gates are in [deployment.md](./docs/deployment.md).

## Known limitations

- Render Free is not always on and provides no availability guarantee suitable for a commercial restaurant.
- Cross-site cookies between provider-generated Vercel and Render domains depend on browser third-party-cookie policy and require live browser verification.
- Socket.IO is single-process and has no Redis adapter; realtime messages are post-commit without a transactional outbox. REST reconciliation recovers missed invalidations.
- Cloudinary cleanup is intentionally manual; replacing or archiving a menu item does not automatically delete historical media.
- Cash and UPI payments are manually recorded. Refunds, reversals, gateway settlement, inventory, and payroll are outside the MVP.
- Tax behavior requires jurisdiction-specific review before real commercial use.
- A Prisma toolchain transitive Effect advisory remains documented pending a compatible upstream release.

## Portfolio material

- [Demo and screenshot guide](./docs/demo-guide.md)
- [2–3 minute demo script](./docs/demo-video-script.md)
- [Portfolio case study](./docs/portfolio-case-study.md)
- [CV and LinkedIn content](./docs/cv-portfolio-content.md)
- [Technical interview preparation](./docs/interview-preparation.md)

RestroFlow is presented as a personally developed, AI-assisted portfolio project. Engineering decisions, source review, tests, and acceptance remain the developer’s responsibility; no users, customers, revenue, uptime, or commercial impact are claimed.
