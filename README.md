# RestroFlow

RestroFlow is a production-minded restaurant operations platform built as a TypeScript monorepo. Parts 1 through 3 provide the application shell, API foundation, PostgreSQL/Prisma connectivity, shared contracts, secure staff authentication, role-based restaurant access, restaurant settings, and staff account management. Menu, table, order, billing, and analytics workflows are intentionally not implemented yet.

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

| Variable       | Purpose                               | Example                     |
| -------------- | ------------------------------------- | --------------------------- |
| `NODE_ENV`     | Runtime mode                          | `development`               |
| `PORT`         | API port                              | `4000`                      |
| `LOG_LEVEL`    | Pino log level                        | `info`                      |
| `CORS_ORIGINS` | Comma-separated trusted web origins   | `http://localhost:3000`     |
| `DATABASE_URL` | Server-only PostgreSQL connection URL | See `apps/api/.env.example` |

To point the browser at a non-default API, set `NEXT_PUBLIC_API_URL` for the web workspace. Never place credentials in a `NEXT_PUBLIC_*` variable.

## Commands

| Command                               | Description                                   |
| ------------------------------------- | --------------------------------------------- |
| `npm run dev`                         | Run web and API development servers           |
| `npm run build`                       | Build all workspaces                          |
| `npm run lint`                        | Lint all workspaces                           |
| `npm run typecheck`                   | Type-check all workspaces                     |
| `npm test`                            | Run Vitest and Supertest suites               |
| `npm run test:e2e`                    | Run Playwright tests (install Chromium first) |
| `npm run format`                      | Format tracked source files                   |
| `npm run format:check`                | Check formatting                              |
| `npm run db:generate`                 | Generate Prisma Client                        |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration      |
| `npm run db:migrate:deploy`           | Apply committed migrations in deployment      |
| `npm run db:seed`                     | Run the explicit safe seed script             |
| `npm run db:studio`                   | Open Prisma Studio                            |

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

For a manual smoke test, sign in as the development admin, update and reload `/admin/settings`, then create, edit, deactivate, and reactivate a non-admin account in `/admin/staff`. Confirm the deactivated account cannot reuse an existing session, verify a sole active admin cannot be demoted or deactivated, and check the layouts at mobile and desktop widths. Finally call the health endpoint and verify `checks.database` is `up`.

## Stopping local services

```bash
docker compose down
```

The named database volume is retained. Use `docker compose down --volumes` only when you intentionally want to delete all local RestroFlow database data.
