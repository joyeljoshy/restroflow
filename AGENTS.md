# RestroFlow Engineering Guide

## Product boundary

RestroFlow is a professional restaurant operations system. Build the single-restaurant MVP in a way that can later support multiple restaurants. Implement only the requested part; do not present placeholders as finished features or move to a later part without explicit instruction.

## Architecture

- `apps/web`: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui primitives, TanStack Query, Zustand, React Hook Form, and Zod.
- `apps/api`: Express TypeScript modular monolith. Organize feature modules into routes, controllers, services, repositories, and validation schemas.
- `packages/contracts`: shared framework-neutral types and Zod wire schemas. Do not put database or UI implementation details here.
- PostgreSQL is authoritative. Prisma owns schema, migrations, and typed database access.
- REST handles commands and authoritative reads. Socket.IO will only notify subscribed clients of changes; reconnecting clients must recover state from REST.
- Keep external infrastructure minimal. Add Redis/BullMQ only for a demonstrated requirement.

## Backend boundaries

- Routes define paths and middleware.
- Controllers translate HTTP input/output and delegate work.
- Services own business rules, authorization orchestration, and transaction boundaries.
- Repositories own persistence queries and do not make authorization decisions.
- Schemas validate every untrusted boundary.
- Throw typed application errors and let the centralized handler create the public response.
- Never leak stacks, credentials, SQL details, or internal errors.

## Security and data rules

- Validate authentication, role authorization, restaurant scope, and resource ownership on every protected request.
- Staff authentication uses secure HTTP-only sessions. Public customer permissions stay separate from staff permissions.
- Never trust client-provided roles, restaurant IDs, prices, taxes, totals, or status transitions.
- Store money as integer minor units; never use floating-point amounts.
- Snapshot menu item and modifier names/prices on order creation.
- Use database transactions for related order and billing writes.
- Require and persist idempotency keys for order submission.
- Use allowlisted CORS origins, bounded request bodies, security headers, secret redaction, and environment validation.
- Do not commit secrets, production credentials, or `.env` files.

## Frontend conventions

- Prefer Server Components. Add `"use client"` only at the smallest interactive boundary.
- TanStack Query owns server state; Zustand is only for cross-component client UI state.
- Use React Hook Form with Zod for non-trivial forms.
- Keep shadcn-style primitives in `components/ui` and compose feature components above them.
- Meet keyboard, focus, label, semantic HTML, contrast, and reduced-motion accessibility needs.
- Every data-driven screen needs deliberate loading, empty, error, and reconnect/recovery states.
- Use responsive layouts and the established warm-neutral/emerald design tokens before adding new visual primitives.

## TypeScript and code style

- Keep strict TypeScript enabled. Avoid `any`; narrow `unknown` at boundaries.
- Use ESM, explicit `.js` suffixes for relative imports in Node code, and workspace package imports across packages.
- Prefer small, testable functions and dependency injection at I/O boundaries.
- Name files by responsibility (`*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`).
- Format with Prettier and lint with ESLint. Do not suppress rules without a documented reason.
- Preserve existing behavior and conventions; avoid unrelated refactors or technologies.

## Database workflow

- Change the Prisma schema only for the requested feature.
- Create migrations with `npm run db:migrate -- --name <descriptive_name>` and review generated SQL.
- Commit migrations; apply them in deployments with `npm run db:migrate:deploy`.
- Seeds must be explicit, repeatable, scoped, and safe. Never hide production mutations in a seed.
- Keep database URLs server-side and instantiate Prisma through the supported PostgreSQL adapter.

## Testing requirements

- Add unit tests for critical business rules and shared contracts.
- Add Supertest integration tests for API behavior, validation, authorization, and restaurant scoping.
- Add repository/integration coverage for transactional and idempotent writes against PostgreSQL when those features arrive.
- Add Playwright coverage for critical user journeys, not implementation details.
- Each change must run the relevant tests plus root lint and type checking. Run a production build for configuration or rendering changes.
- A bug fix should include a regression test when practical.

## Feature workflow

1. Inspect the repository and current conventions.
2. State a brief scoped plan.
3. Implement only the requested feature and necessary support.
4. Add or update relevant tests.
5. Run formatting checks, lint, type checking, tests, and relevant builds.
6. Report changed files, exact commands/results, blockers, and manual verification steps.
7. Stop until the next part is explicitly requested.
