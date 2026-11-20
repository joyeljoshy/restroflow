# RestroFlow Part 11 Hardening Report

Date: 2026-11-20

## Executive summary

Part 11 hardened the existing single-restaurant MVP without adding business
features. Two high-impact defects were fixed: browser commands and WebSocket
handshakes did not consistently enforce the configured origin allowlist, and
the compiled API could not start because the shared contracts package emitted
declarations but no runtime JavaScript. The authentication, customer ordering,
RBAC, restaurant isolation, order concurrency, billing, upload, and realtime
implementations were reviewed against their direct API and PostgreSQL tests.

No unresolved critical defect was found. One high-severity dependency advisory
remains in the installed Prisma toolchain. Its vulnerable Effect API is not
called by RestroFlow, and no compatible stable Prisma 7 patch exists as of this
review. It remains a tracked deployment risk rather than being hidden by a
forced downgrade or unverified override.

## Prioritized findings

| Severity                                | Component                        | Evidence                                                                                                                                                      | Remediation and verification                                                                                                                                                                                                                                  | Residual risk                                                                                                                                                                      |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High (fixed)                            | REST CSRF/origin enforcement     | Customer commands checked `Origin`; staff POST/PATCH/PUT/DELETE routes did not. `SameSite=Lax` is not a complete defense for same-site cross-origin requests. | A global unsafe-method origin guard now covers `/api/v1`. Direct Supertest verifies trusted, untrusted, and non-browser requests.                                                                                                                             | Requests without `Origin` remain allowed for non-browser API clients. Compromised trusted origins remain trusted.                                                                  |
| High (fixed)                            | Socket.IO cross-origin handshake | Socket.IO CORS configuration alone did not explicitly reject every WebSocket upgrade origin.                                                                  | `allowRequest` rejects untrusted origins before socket authentication. Integration coverage verifies rejection.                                                                                                                                               | Single-process rooms remain an MVP limitation.                                                                                                                                     |
| High (fixed)                            | Production API startup           | `@restroflow/contracts` exported TypeScript source and its build emitted declarations only. `node dist/server.js` failed with `ERR_MODULE_NOT_FOUND`.         | Contracts now emit ESM JavaScript with explicit `.js` imports; API/web build and test lifecycles build contracts first. The compiled API started and returned HTTP 200 from liveness and readiness.                                                           | Build scripts intentionally rebuild the small contracts package more than once for workspace safety.                                                                               |
| High advisory / low reachability (open) | Prisma toolchain dependency      | `npm audit`: GHSA-7589-6fvf-x4pw / CVE-2026-121707, `prisma@7.10.1 -> @prisma/config@7.10.1 -> effect@3.20.0`; affected range is `effect <=3.22.0`.           | No forced fix applied. Prisma 7.10.1 is the latest stable line available during review and pins Effect 3.20.0. RestroFlow does not import Effect or use `Schema.TemplateLiteral`.                                                                             | The vulnerable package is installed and can be reached by Prisma tooling. Recheck for a stable Prisma release that carries Effect 3.22.1 or later.                                 |
| Medium (fixed)                          | Health checks                    | `/health` combined process liveness and database readiness.                                                                                                   | Added `/health/live` (no database query) and `/health/ready` (database-backed), preserving `/health`. Tests cover database-down behavior.                                                                                                                     | No external monitoring system is introduced in Part 11.                                                                                                                            |
| Medium (fixed)                          | CI E2E coverage                  | CI stopped after build and never ran Playwright.                                                                                                              | CI installs Chromium and runs `npm run test:e2e` after the production build.                                                                                                                                                                                  | Live database browser journeys remain opt-in because they create isolated fixtures and bind local ports.                                                                           |
| Medium (fixed)                          | Dialog accessibility             | Dialog ARIA IDs were static and focus could escape with Tab. Smooth scrolling ignored reduced-motion preferences.                                             | Unique ARIA IDs, focus trapping/restoration, and reduced-motion CSS were added. Axe and keyboard Playwright checks cover representative screens and the dialog.                                                                                               | Automated checks are not a claim of complete WCAG conformance; manual assistive-technology testing is still required.                                                              |
| Medium (fixed)                          | Analytics benchmark validity     | The old fixture had 500 rows. Immediate post-insert plans had stale statistics and selected quadratic nested loops.                                           | The benchmark supports 1-50,000 rows, batches writes, includes histories/modifiers/bills/payments, refreshes planner statistics, reports median/p95/environment, optionally summarizes `EXPLAIN ANALYZE`, refuses production, and restricts remote databases. | A 50,000-row run was deferred; 10,000 rows already required about one minute to create, measure, and clean on the review laptop.                                                   |
| Medium (fixed)                          | API load reproducibility         | No controlled HTTP load harness existed.                                                                                                                      | Added a localhost-first, production-disabled isolated fixture harness for public/authenticated reads and order creation with p50/p95/p99, throughput, errors, CPU, and RSS.                                                                                   | Results are workstation measurements, not universal SLOs. The pg 8 adapter emitted a pg 9 deprecation warning under concurrent transactional writes; track upstream compatibility. |
| Medium (improved)                       | Operational logging              | Request completion logs had request IDs, status, and duration, but typed auth/authorization/conflict failures lacked a stable error code field.               | Typed 401/403/409/5xx failures now log safe method/path/status/error-code fields. Cookie and Authorization headers remain redacted.                                                                                                                           | Centralized log shipping, metrics, tracing, and retention are deployment work.                                                                                                     |
| Low / deferred                          | React maintainability            | Several client components are 500-950 lines. Socket cleanup and query keys are stable, and no measured render regression was found.                           | No speculative memoization or broad component rewrite was made.                                                                                                                                                                                               | Profile production traffic before splitting components solely for performance.                                                                                                     |

## Dependency advisory analysis

- Advisory: [GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw), Effect `Schema.TemplateLiteral` regular-expression denial of service.
- Installed path: `prisma@7.10.1 -> @prisma/config@7.10.1 -> effect@3.20.0`.
- A second optional peer path is visible through `@hookform/resolvers`, but the application imports the Zod resolver, not an Effect resolver.
- `npm audit` reports three high entries because it reports Effect and the two packages in its dependency chain. There is one underlying advisory and no critical advisory.
- The suggested automatic change is Prisma 6.12.0. That is a major downgrade from Prisma 7 and was rejected.
- Reachability: the API and web application do not import Effect. The affected schema-template compiler is not used in application request validation. Prisma config/migration/generation commands load the affected package, so the risk is reduced, not zero.
- Current mitigation: database/schema commands are privileged operational actions, input sizes at public API boundaries are bounded, and untrusted users cannot supply Prisma config schemas.
- Future action: upgrade the aligned Prisma packages when a stable compatible release pins Effect 3.22.1 or newer; rerun generation, validation, migration status, the production-start smoke test, and the full suite.

## Authentication, authorization, and customer security

### Staff authentication

- Passwords use Argon2id (`m=19456`, `t=2`, `p=1`). Unknown-account login still performs a dummy Argon2 verification.
- Session tokens use 32 random bytes encoded as base64url; only SHA-256 hashes are stored.
- Cookies are HTTP-only, `SameSite=Lax`, path `/`, and `Secure` in production.
- Login is source-address rate limited, successful attempts are not counted, and responses avoid account enumeration.
- Expired, revoked, inactive-user, and membership-less sessions are rejected. Role/status changes revoke active sessions transactionally.
- Protected routes authenticate, derive restaurant scope from active membership, then enforce roles. Resource repositories also include the verified restaurant ID.
- Global origin enforcement now protects browser mutations; direct non-browser requests remain possible by design and still require authentication/authorization.

### Customer ordering

- QR identifiers and session tokens use 32 random bytes. QR identifiers locate tables but never authorize orders.
- Six-digit activation codes are Argon2id-hashed, single-use, expire after ten minutes, and lock after five atomic failed attempts. Public activation and ordering are additionally rate limited.
- Customer sessions are separate from staff sessions, expire after four hours, and are bound to restaurant plus open table session.
- Closing/deactivating a table or restaurant invalidates REST and realtime access.
- Customer order reads and socket subscriptions require the owning customer session. Cross-table, cross-customer, and cross-restaurant filters are server-derived.
- Public menu responses expose only filtered active menu data and table/restaurant presentation context.

### RBAC and object isolation

All restaurant, staff, menu, table, order, kitchen, billing, payment, and
analytics routes were traced from middleware through service and repository.
Protected repositories consistently receive a restaurant ID derived from an
authenticated membership. Object reads and writes use compound restaurant
filters or restaurant-scoped `findFirst` calls. Existing negative tests cover
role restrictions and cross-restaurant access; Part 11 adds origin and socket
handshake negatives.

## Orders, billing, and concurrency

- Order creation/add-item writes reserve and complete actor-scoped idempotency keys in the same transaction as immutable snapshots.
- Table-session row locks serialize order creation/additions with bill finalization. Order row locks and versions protect lifecycle updates.
- Menu price/name/modifier snapshots are server-calculated and immutable. Terminal orders reject further mutation.
- Bill finalization locks the table session and orders and creates one immutable bill plus item/modifier snapshots atomically.
- Payment idempotency is actor scoped and bill-bound. Bill row locks prevent concurrent overpayment; database checks enforce positive payments and consistent balances/statuses.
- Session closure locks the session, rejects unresolved orders, verifies complete billing, locks the bill, and requires a zero outstanding balance.
- Existing live PostgreSQL tests cover duplicate order/payment submissions, conflicting idempotency payloads, stale versions, race conditions, rollback, cross-restaurant access, tax snapshots, and historical receipt values.

## API, upload, and realtime review

- Express uses Helmet, an origin allowlist, a 1 MB JSON bound, typed Zod validation, centralized public errors, and secret-safe error responses.
- Menu images are limited to 3 MB, allowlisted to JPEG/PNG/WebP, checked by file signature, assigned UUID filenames, written with exclusive creation, and served without directory indexes or dotfiles.
- Local image storage is not durable across ephemeral or multi-instance deployments and needs persistent shared storage or an object-store adapter before such a deployment.
- Socket rooms derive restaurant/customer scope from authenticated server state. Roles are revalidated on subscribe, periodically, and before publication; revocation disconnects clients.
- Events are minimal versioned invalidations published after commit. REST remains authoritative after duplicates, missed events, out-of-order delivery, and reconnects.
- There is no transactional outbox or cross-process Socket.IO adapter. Multi-instance realtime delivery is therefore not deployment-ready without later infrastructure work.

## PostgreSQL performance results

Environment: Node 24.22.1, PostgreSQL 17.12 in the local Docker environment,
Windows x64 host, Intel i5-10210U (8 logical CPUs), four concurrent analytics
queries, seven timed samples per query. Every generated row fell inside the
measured range, and fixture cleanup used only a generated restaurant UUID.

|   Rows | Query         |   Median |      p95 |
| -----: | ------------- | -------: | -------: |
|  1,000 | Overview      |  9.10 ms | 10.94 ms |
|  1,000 | Sales         |  5.56 ms |  5.90 ms |
|  1,000 | Payments      |  5.77 ms | 10.01 ms |
|  1,000 | Popular items |  9.07 ms | 49.78 ms |
| 10,000 | Overview      | 16.68 ms | 20.70 ms |
| 10,000 | Sales         | 13.35 ms | 17.65 ms |
| 10,000 | Payments      | 14.21 ms | 17.30 ms |
| 10,000 | Popular items | 42.00 ms | 57.13 ms |

The 1,000-row popular-items plan used three hash joins, stayed in memory with no
temporary reads/writes, and executed in 5.011 ms after 0.869 ms planning. It
used sequential scans of `Bill`, `BillItem`, and `OrderItem`; this is appropriate
for the isolated fixture because almost every row in those small tables belongs
to the measured restaurant and range. No additional index was justified.

Before statistics refresh, the immediately inserted fixture was estimated as
one row and the plan performed approximately 380,000 shared-buffer hits via
nested loops, taking about 130 ms. The harness now runs `ANALYZE` before timed
queries so it measures representative planner behavior rather than fixture
setup artifacts.

## API load-test results

The harness used an isolated local restaurant, 10 concurrent readers (five for
analytics and order writes), and removed only its generated fixture. No request
failed in the accepted run.

| Target                  | Requests / concurrency |   Throughput |       p50 |       p95 |       p99 | Errors |
| ----------------------- | ---------------------- | -----------: | --------: | --------: | --------: | -----: |
| Public menu             | 100 / 10               | 137.36 req/s |  60.98 ms | 167.51 ms | 177.42 ms |     0% |
| Authenticated menu      | 100 / 10               | 138.69 req/s |  65.15 ms | 108.68 ms | 115.94 ms |     0% |
| Table list              | 100 / 10               | 178.68 req/s |  55.98 ms |  60.58 ms |  61.30 ms |     0% |
| Kitchen tickets         | 100 / 10               | 136.84 req/s |  71.59 ms |  85.38 ms |  89.04 ms |     0% |
| Analytics overview      | 50 / 5                 | 101.99 req/s |  47.51 ms |  65.22 ms |  65.99 ms |     0% |
| Billing active sessions | 100 / 10               |  88.38 req/s |  87.96 ms | 193.99 ms | 195.05 ms |     0% |
| Order creation          | 25 / 5                 |  25.89 req/s | 181.45 ms | 249.97 ms | 292.30 ms |     0% |

Process CPU during the complete run was about 5,188 ms user and 1,141 ms system;
RSS rose from 135 MB to 258 MB. Billing listing and order creation are the first
targets for production profiling, but this workstation run does not establish
an SLO or justify a query/index rewrite by itself.

## React, Next.js, and accessibility

- TanStack Query owns server state and Zustand remains limited to draft carts/navigation.
- Query keys are deterministic. Socket effects remove both socket and manager listeners and disconnect on cleanup.
- Reconnect paths invalidate authoritative REST queries; no sensitive cross-user Next.js cache was introduced.
- The production build statically renders non-dynamic shells and keeps the public table route dynamic.
- Large client components remain a maintainability concern, but there was no measured reason for broad `memo`, `useMemo`, or component splitting.
- Axe WCAG 2.0/2.1 A/AA checks found no serious or critical violations on login, the authenticated admin shell, or the customer menu.
- Playwright keyboard checks verify focus enters the dialog and wraps from first to last and last to first. Escape support and focus restoration remain in the shared component.
- Charts include textual KPI/definition alternatives and withhold unsafe numeric visualizations, but a manual screen-reader pass of chart interaction is still recommended.

## Observability and health

- Pino HTTP logs include request ID, method/route, response status, and duration.
- Typed authentication, authorization, conflict, and server failures add stable `errorCode` and safe request context.
- Authorization and Cookie headers are redacted. Passwords, activation codes, raw tokens, payment credentials, and cookie values are not deliberately logged.
- `/api/v1/health/live` proves the process can respond without depending on PostgreSQL.
- `/api/v1/health/ready` returns 200 only when PostgreSQL is reachable and otherwise returns a safe 503 payload.
- `/api/v1/health` remains a compatibility alias for readiness.

## CI and verification

The workflow now checks out with read-only repository permissions, installs via
`npm ci`, generates Prisma Client, applies all migrations to an isolated
PostgreSQL 17 service, checks formatting/lint/types, runs unit/integration tests,
builds production artifacts, installs Chromium, and runs standard Playwright
journeys.

Verification completed during Part 11:

- Formatting, lint, strict type checking, Prisma generation, schema validation, migration status, unit/integration tests, and production builds passed.
- All 11 migrations were applied and the schema was current.
- Standard Playwright: 27 passed and 3 opt-in live specs skipped in the normal run.
- Automated accessibility: 3 representative Playwright checks passed.
- Complete live journey: passed using real Next.js, Express, PostgreSQL, Socket.IO, and isolated data. It configured the restaurant/menu, opened a table, activated customer ordering, submitted and tracked an order, moved it through kitchen/served states, finalized and paid the bill, closed the session, and verified analytics.
- Compiled API smoke: `node dist/server.js` started successfully; liveness and readiness both returned HTTP 200.
- Dependency audit: one underlying high advisory remains, reported as three dependency-chain entries; no critical advisories.

## Known limitations and deployment readiness

### Fixed in Part 11

- REST and WebSocket cross-origin command/handshake enforcement.
- Runnable shared-contract ESM output for compiled deployments.
- Explicit liveness/readiness endpoints.
- Dialog focus trapping, unique ARIA relationships, and reduced-motion handling.
- CI standard browser coverage.
- Reproducible larger analytics and HTTP load harnesses with safety guards.
- Structured typed failure logging.

### Accepted MVP limitations

- Single-process Socket.IO without Redis or a broker.
- Post-commit notifications without an outbox; REST reconciliation recovers missed events.
- Local menu image storage.
- Manual UPI/cash records without gateway verification, refunds, or reversals.
- Short staff-mediated customer activation code as proof of access, not strong physical-presence proof.
- Jurisdiction-specific review is still required for configured tax behavior.

### Deferred improvements

- Upgrade Prisma when a compatible Effect security fix is published.
- Run 50,000-row database benchmarks on deployment-class hardware.
- Profile billing list/order creation under representative network and database latency.
- Add distributed rate limiting and realtime fan-out only when multi-instance deployment is approved.
- Perform manual keyboard, screen-reader, zoom, contrast, and touch testing across every critical role journey.
- Add metrics/tracing/log shipping and deployment alerts in the deployment phase.

### Deployment blockers

RestroFlow is materially closer to production readiness, but Part 12 should not
deploy a multi-instance or ephemeral-filesystem configuration without solving
realtime fan-out/outbox expectations and durable image storage. The open Prisma
toolchain advisory also requires an explicit risk acceptance or compatible
upstream patch before a security-sensitive production launch.

## Recommended Part 12 priorities

1. Pin and verify the deployment artifact/runtime dependency set; recheck the Prisma advisory immediately before release.
2. Choose a single-instance deployment or explicitly add approved multi-instance realtime infrastructure and an outbox strategy.
3. Provide durable menu-image storage, backup/restore, migration rollback planning, and secret management.
4. Add production metrics, centralized logs, readiness-based rollout, alerts, and capacity tests on deployment hardware.
5. Complete jurisdictional tax review and a manual accessibility acceptance pass.
