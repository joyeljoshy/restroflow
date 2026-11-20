# RestroFlow technical interview preparation

Each answer describes the current implementation, then names the tradeoff rather than implying unlimited scale.

## React and Next.js

### 1. Why use the Next.js App Router?

**Answer:** It provides route/layout composition and Server Components by default while allowing client code only at interactive boundaries. **RestroFlow:** route pages/layouts frame role workspaces; forms, TanStack Query, carts, charts, auth, and sockets are client components. **Tradeoff:** much of the operational UI is interactive, so several feature components are still large client bundles. **Follow-up:** How would you measure and split those bundles without speculative refactoring?

### 2. How do you separate server state from UI state?

**Answer:** TanStack Query owns REST data, caching, invalidation, retries, and loading/error state. Zustand holds only cross-component draft/UI state. **RestroFlow:** waiter/customer carts are drafts; orders, menu, bills, and sessions always come from REST. **Tradeoff:** reconnect invalidation can cause extra reads, but avoids two competing sources of truth. **Follow-up:** When would optimistic updates be safe here?

### 3. How does the frontend recover from realtime disconnects?

**Answer:** It shows connection state, reconnects Socket.IO, deduplicates event IDs/versions, and invalidates authoritative REST queries after connect/reconnect/events. **RestroFlow:** kitchen, waiter, cashier, and customer flows never depend solely on an event payload. **Tradeoff:** recovery is eventually consistent and adds database/API traffic. **Follow-up:** How would you add backoff and stale-state UX?

## TypeScript

### 4. Why share runtime contracts instead of only TypeScript interfaces?

**Answer:** Static types disappear at runtime; Zod schemas validate untrusted JSON and also infer TypeScript types. **RestroFlow:** `packages/contracts` owns request/response/event wire schemas used by web and API. **Tradeoff:** schema changes require coordinated package builds and can duplicate database constraints. **Follow-up:** How would you version a breaking public contract?

### 5. How do you avoid `any` at boundaries?

**Answer:** Treat parsed JSON/socket input as `unknown`, validate it, then use inferred types. Narrow errors before reading fields. **RestroFlow:** API middleware and client response/event handlers use shared schemas. **Tradeoff:** validation adds code and runtime cost, but makes failures explicit. **Follow-up:** Where should database result validation still be considered?

## Node.js and Express

### 6. Why a modular monolith instead of microservices?

**Answer:** The workflows share transactions and one data model, while the team/project does not require independent deploy/scale boundaries. **RestroFlow:** modules have route/controller/service/repository separation inside one process. **Tradeoff:** a process failure affects all modules and horizontal scaling needs shared realtime/rate-limit infrastructure. **Follow-up:** What evidence would justify extracting billing or analytics?

### 7. What belongs in controllers, services, and repositories?

**Answer:** Controllers translate HTTP, services enforce business/authorization rules and transactions, repositories own persistence queries. **RestroFlow:** centralized typed errors keep transport concerns out of repositories. **Tradeoff:** interfaces add indirection, but make I/O boundaries testable. **Follow-up:** Where should a transaction callback live?

### 8. How is production startup/shutdown handled?

**Answer:** The compiled ESM server binds `0.0.0.0:$PORT`, shares HTTP with Socket.IO, logs sanitized listen failures, and closes realtime plus Prisma on SIGINT/SIGTERM. **Tradeoff:** in-flight request draining is basic and Render can force termination after its window. **Follow-up:** How would you add readiness removal and bounded drain time?

## PostgreSQL and Prisma

### 9. Why PostgreSQL instead of MongoDB?

**Answer:** Orders/bills require multi-record transactions, row locks, compound scope constraints, check constraints, and relational analytics. PostgreSQL matches those invariants directly. **RestroFlow:** unique partial indexes prevent two open sessions; bill/payment constraints protect balances. **Tradeoff:** schema migration discipline is required and document-shaped reads need joins. **Follow-up:** Which data, if any, could live outside PostgreSQL?

### 10. How does Prisma 7 connect to Neon?

**Answer:** Runtime Prisma uses `@prisma/adapter-pg` with Neon's pooled TLS `DATABASE_URL`; Prisma CLI uses direct `DIRECT_URL` through `prisma.config.ts`. **Tradeoff:** two secrets must be managed correctly, and Neon can cold-start after scale-to-zero. **Follow-up:** Why should migrations avoid a transaction pooler?

### 11. How are schema changes deployed safely?

**Answer:** Create migrations locally with `migrate dev`, review committed SQL, then run `migrate deploy` once as an approved operation using the direct URL. **RestroFlow:** 11 migrations are immutable; startup never migrates. **Tradeoff:** there is no fully automated zero-downtime migration orchestration on the free plan. **Follow-up:** How would you execute expand/migrate/contract changes?

## Authentication and security

### 12. Why opaque sessions instead of JWTs?

**Answer:** Opaque tokens enable immediate server-side revocation and keep role/status changes authoritative. Only a SHA-256 token hash is stored; the raw token stays in an HTTP-only cookie. **Tradeoff:** every protected request needs a database/session lookup. **Follow-up:** How would you cache sessions without weakening revocation?

### 13. How do staff and customer authentication differ?

**Answer:** Staff sessions represent a user with restaurant memberships/roles. Customer sessions are separate tokens bound to one restaurant, open table session, and owned orders after a one-time activation code. **Tradeoff:** the staff-issued six-digit code is not strong physical-presence proof. **Follow-up:** How would device approval improve it?

### 14. How do you prevent cross-restaurant access?

**Answer:** Membership scope is derived server-side, role middleware runs before controllers, services check ownership, and repositories query with the verified restaurant ID/compound keys. Negative tests exercise foreign IDs. **Tradeoff:** every new query must preserve that convention. **Follow-up:** Would PostgreSQL row-level security add useful defense in depth?

### 15. Why `SameSite=None` in production?

**Answer:** Vercel and Render generated domains are cross-site, so credentialed fetch/WebSocket cookies need `Secure; SameSite=None`, exact CORS origins, and origin-protected mutations. **Tradeoff:** browser third-party-cookie blocking can still prevent authentication. **Follow-up:** What same-site domain topology would avoid that?

## REST API design

### 16. How are errors made safe and useful?

**Answer:** Services throw typed application errors; one handler emits stable code/message/status and request IDs without stacks, SQL, or credentials. **Tradeoff:** unexpected errors deliberately lose client detail and require server logs for diagnosis. **Follow-up:** How would you correlate logs across services later?

### 17. Why return conflicts for stale updates?

**Answer:** `409` tells the client its expected version/transition/idempotency assumption no longer matches authoritative state. **RestroFlow:** order versions prevent silent last-write-wins. **Tradeoff:** the UI must refetch and ask the user to reconcile. **Follow-up:** When is `412 Precondition Failed` with ETags preferable?

## Transactions and concurrency

### 18. What happens when two kitchen users update the same item?

**Answer:** The transaction locks/checks current state and expected version/policy; only the valid transition commits, while stale/conflicting work returns a conflict and refetches. Item history and aggregate order status update atomically. **Tradeoff:** hot orders serialize briefly. **Follow-up:** How would you test the race with two database connections?

### 19. What happens when two cashiers record payment concurrently?

**Answer:** Payment idempotency is reserved transactionally and the bill row is locked. Each command recalculates outstanding value after the lock; an overpayment cannot commit, and database checks enforce paid/status consistency. **Tradeoff:** concurrent writes to one bill serialize. **Follow-up:** What isolation anomalies remain at PostgreSQL's default level?

### 20. Why combine optimistic versions and pessimistic locks?

**Answer:** Versions detect stale user intent across requests; row locks serialize critical database decisions inside one transaction. **RestroFlow:** order versions protect lifecycle commands while bill/session/payment locks protect monetary/finalization races. **Tradeoff:** more conflict handling and careful lock ordering. **Follow-up:** How do you avoid deadlocks?

## Idempotency

### 21. How do you prevent duplicate order submissions?

**Answer:** Clients send an idempotency key; the server hashes the normalized request and stores actor/key/operation/result in the same transaction as the order. A retry with the same body returns the result; a changed body conflicts. **Tradeoff:** records need expiry/cleanup strategy and keys must be scoped correctly. **Follow-up:** Why is a frontend disabled button insufficient?

### 22. How is payment idempotency different?

**Answer:** It is scoped to restaurant, staff actor, key, and bill, then completed with the payment response in the locked bill transaction. **Tradeoff:** sharing a key across actors does not deduplicate, by design. **Follow-up:** How should a mobile client persist keys across network retries?

## Socket.IO and realtime

### 23. How are Socket.IO rooms authorized?

**Answer:** Handshake cookies are authenticated, restaurant/customer scope is derived server-side, roles determine staff channels, and customer order ownership is checked before joining a session room. Sessions are revalidated. **Tradeoff:** revalidation adds database reads. **Follow-up:** What attack occurs if room names come directly from client input?

### 24. What if the API commits an order then crashes before publishing?

**Answer:** The order remains correct in PostgreSQL, but connected clients may miss the invalidation until poll/manual/reconnect refetch. This is an acknowledged post-commit publication gap. **Tradeoff:** the MVP avoids outbox/broker complexity. **Follow-up:** Design a transactional outbox worker and deduplication scheme.

### 25. How would you scale Socket.IO across instances?

**Answer:** Add a shared adapter/broker, sticky/compatible connection routing where needed, distributed session/rate-limit state, and an outbox or durable event publisher. **RestroFlow:** free Render is intentionally one instance, so Redis is not added. **Tradeoff:** infrastructure and operational cost rise materially. **Follow-up:** Which delivery guarantee would you promise?

## Billing accuracy

### 26. How do you keep tax calculations accurate?

**Answer:** Money is integer minor units, tax rates are integer basis points, rounding is deterministic, the server computes totals, and finalized bills snapshot tax configuration. Database checks reject inconsistent balances. **Tradeoff:** jurisdiction-specific rounding/invoice rules still need legal review. **Follow-up:** How would inclusive tax change line calculations?

### 27. How do historical prices survive menu changes?

**Answer:** Orders snapshot item/modifier names and prices at creation; bills snapshot those lines again at finalization. Foreign menu records can later change without rewriting historical receipts. **Tradeoff:** duplicated historical data requires more storage. **Follow-up:** Why not join the current menu for receipts?

### 28. Is UPI integrated?

**Answer:** No. Cash and UPI are manually recorded payment methods with optional reference/note. There is no gateway, webhook, settlement, refund, or external verification. **Tradeoff:** operator accuracy is required. **Follow-up:** What states and idempotency would a real gateway add?

## Performance and scalability

### 29. How are analytics made timezone-aware and efficient?

**Answer:** The service converts restaurant-local date boundaries to instants, then repositories aggregate in PostgreSQL using scoped/date indexes. **Tradeoff:** complex reports remain database work and should be profiled with production-like distributions. **Follow-up:** When would you add rollups/materialized views?

### 30. What do the benchmarks prove?

**Answer:** They provide reproducible workstation evidence for specific fixture sizes, query mixes, and versions; they do not establish production SLOs. **RestroFlow:** the harness refreshes planner statistics and reports median/p95/environment. **Tradeoff:** synthetic data/network differ from deployment. **Follow-up:** How would you design a capacity test on Neon/Render without causing cost or abuse?

## Testing

### 31. What is the testing strategy?

**Answer:** Use unit/contract tests for rules, Supertest for HTTP/security, real PostgreSQL integration for transactions/races, Playwright for critical journeys/accessibility, and build/start smoke checks for deployment. **Tradeoff:** live integration/E2E is slower and opt-in locally. **Follow-up:** Which tests belong in every pull request versus release validation?

### 32. How do you test restaurant/customer isolation?

**Answer:** Create two scoped actors/resources and assert foreign IDs return denial/hidden not-found without leaking data; repeat through REST and Socket.IO subscription paths. **Tradeoff:** test fixtures are verbose but prevent a high-impact regression. **Follow-up:** How would property-based testing extend scope coverage?

## Deployment and DevOps

### 33. What happens when Render Free sleeps?

**Answer:** After its idle threshold the process stops, sockets disconnect, and the next HTTP/WebSocket connection triggers a cold start that can take about a minute. Ephemeral files disappear. **RestroFlow:** images use Cloudinary, clients reconnect/refetch, and no keep-alive circumvention is used. **Tradeoff:** first-request latency is unsuitable for always-on operations. **Follow-up:** What would the paid production topology change?

### 34. Why are migrations not run on API startup?

**Answer:** Multiple starts can race, schema changes may require review/backup, and a failed migration should not create restart loops. A separately approved direct-connection `migrate deploy` precedes rollout. **Tradeoff:** deployment has a manual controlled step on the free plan. **Follow-up:** How would a paid CI/CD system gate and audit it?

### 35. How would you upgrade for commercial use?

**Answer:** Move to always-on paid compute, same-site custom domains, managed PostgreSQL with backups/PITR, durable object storage lifecycle, centralized metrics/logs/traces, distributed rate limits, outbox plus brokered realtime, tested restore/runbooks, gateway payments, legal/tax review, and capacity/SLO work. **Tradeoff:** cost and operational complexity increase. **Follow-up:** Which upgrade is first and why?

## System design and AI-assisted development

### 36. What is the most important system invariant?

**Answer:** PostgreSQL, not any browser or socket, is authoritative for restaurant-scoped operational and financial state. That drives server pricing, transactions, snapshots, recovery, and constraints. **Tradeoff:** availability depends on the database. **Follow-up:** How would you design degraded read behavior?

### 37. How did you use Codex while ensuring correctness?

**Answer:** Codex assisted with inspection, implementation drafts, tests, documentation, and checklists; I retained decisions, reviewed diffs, checked official sources, ran strict types/tests/builds, and maintained approval/destructive-action boundaries. **Tradeoff:** AI can produce plausible but incorrect code or claims, so evidence and source review are mandatory. **Follow-up:** Give an example of a generated change you would reject.
