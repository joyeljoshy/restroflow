# RestroFlow

RestroFlow is a production-minded restaurant operations platform built as a TypeScript monorepo. Part 1 provides the application shell, API foundation, PostgreSQL/Prisma connectivity, shared contracts, and test tooling. Authentication and restaurant business workflows are intentionally not implemented yet.

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

No initial domain migration exists because Part 1 deliberately defines no restaurant or authentication models.

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

For a manual smoke test, open the landing, login, `/admin`, `/kitchen`, and `/waiter` routes. Confirm the layouts work at mobile and desktop widths, then call the health endpoint and verify `checks.database` is `up`.

## Stopping local services

```bash
docker compose down
```

The named database volume is retained. Use `docker compose down --volumes` only when you intentionally want to delete all local RestroFlow database data.
