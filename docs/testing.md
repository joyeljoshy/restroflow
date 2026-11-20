# Testing and verification

## Automated layers

- Contract/unit tests: Zod boundaries, policies, currency/tax utilities, stores, and components.
- API tests: Supertest behavior, validation, authentication, role enforcement, trusted origins, and scoped errors.
- PostgreSQL integration: opt-in transactional order, customer, billing, and analytics paths against a real isolated database.
- Browser: Playwright route/workflow tests, accessibility checks, and opt-in real-service journeys.
- Operational: compiled API health smoke, analytics benchmark, and isolated localhost load harness.

CI uses Ubuntu, Node 24, PostgreSQL 17, `npm ci`, Prisma generation, all committed migrations, format/lint/types/tests/build, Chromium install, and standard Playwright. It has read-only repository permissions and no production secrets or deployment step.

## Required Part 12 commands

Run from the repository root:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run db:generate
npm.cmd exec -w @restroflow/api -- prisma validate
git diff --check
```

With local PostgreSQL running, additionally run `npm run db:migrate:deploy` and `prisma migrate status` against the local URL only. Never point these commands to Neon without the database gate.

Focused Part 12 evidence includes production environment acceptance/rejection, `SameSite=None; Secure` staff cookies, exact origin rejection, Cloudinary adapter success/failure/URL validation with a mock uploader, health separation, compiled startup, workspace runtime imports, and existing isolation/concurrency suites.

Cloudinary and live-provider tests remain blocked until external credentials/resources are separately approved. They must be reported as unverified rather than mocked success.

## Current run record

Run on 2026-11-20 against the local worktree and local PostgreSQL 17:

| Command/check                      | Result                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run format:check`             | Passed                                                                                        |
| `npm run lint`                     | Passed across API, web, contracts                                                             |
| `npm run typecheck`                | Passed across API, web, contracts; Prisma generated                                           |
| `npm test`                         | Final run passed: API 105, web 25, contracts 30 (160 total)                                   |
| `npm run build`                    | Passed; API compiled and Next.js generated 15 static routes plus the dynamic table-menu route |
| `npm run test:e2e`                 | 27 passed; 3 opt-in live-service specs skipped by design                                      |
| `npm run db:generate`              | Passed with Prisma 7.10.1                                                                     |
| `prisma validate`                  | Schema valid                                                                                  |
| `prisma migrate status`            | Local database current; 11 migrations found                                                   |
| `npm run db:migrate:deploy`        | Local database: no pending migrations                                                         |
| Compiled production startup        | `dist/server.js` started on an isolated port; liveness and readiness returned 200             |
| `npm audit --audit-level=critical` | No critical advisory; three high chain entries from one Effect advisory                       |
| `git diff --check`                 | Passed                                                                                        |

The first full unit/integration run had one transient failure in the existing concurrent-overpayment race: the losing request surfaced `500` instead of expected `409`. The focused test immediately passed, and the complete second run passed all 160 tests. The run also emitted the already tracked `pg` warning about concurrent `client.query()` usage becoming unsupported in pg 9. Treat this as adapter/concurrency follow-up evidence, not as a hidden clean first pass.

Registry verification found Prisma 7.10.1 is the latest stable 7.x release available (`prev` tag; `latest` points to a Prisma 8 release candidate) and `@prisma/config@7.10.1` still pins Effect 3.20.0. No compatible stable advisory fix was available, so the breaking `npm audit fix --force` downgrade was not applied.

Historical Part 11 results remain in [part-11-hardening-report.md](./part-11-hardening-report.md) and are not silently treated as current.
