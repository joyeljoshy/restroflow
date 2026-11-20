# Portfolio case study: RestroFlow

## Problem

Restaurant work crosses several actors who need the same operational truth at different speeds: a waiter submits changes, a kitchen prepares individual items, a customer wants status, and a cashier must produce an accurate immutable bill. A UI-only prototype can make that flow look convincing while still failing under retries, simultaneous updates, tenant mistakes, or reconnects.

## Approach

RestroFlow treats PostgreSQL as authoritative and builds a modular TypeScript system around explicit boundaries. Shared Zod contracts define the wire format. Express services own authorization and transactions; repositories own scoped queries. Next.js uses TanStack Query for server state and small Zustand stores only for draft carts/UI state. Socket.IO carries invalidations, then clients recover authoritative state from REST.

The most important implementation work is below the visible screens: server-side pricing, immutable snapshots, actor-scoped idempotency, optimistic versions, database row locks, compound restaurant keys, separate customer/staff sessions, and financial check constraints.

## Engineering decisions

- PostgreSQL over a document database: relational constraints, multi-record transactions, row locking, aggregation, and immutable billing relationships are central requirements.
- Modular monolith over microservices: one team/project needs strong transactions and simple deployment more than independent scaling boundaries.
- Opaque cookies over browser tokens: revocation and role changes remain server controlled, while scripts cannot read HTTP-only credentials.
- Minimal realtime events over state replication: missed messages do not corrupt application truth; reconnect is a REST refetch.
- Integer money over floating point: tax and totals stay deterministic and database-checkable.
- Cloudinary adapter over Render disk: Free Render storage is ephemeral, while local storage remains convenient in development.

## Quality evidence

The project includes contract/unit tests, Supertest routes, opt-in real PostgreSQL concurrency journeys, Playwright flows, accessibility automation, production builds, a Linux CI database, and isolated benchmark/load harnesses. Historical measurements are documented with workstation/environment caveats rather than presented as universal SLOs.

## Tradeoffs

The zero-cost deployment sleeps, cold-starts, and runs one realtime process. Notifications are post-commit without an outbox. Cross-site provider domains depend on third-party-cookie policy. UPI is manually recorded, tax behavior needs jurisdiction review, and Cloudinary orphan cleanup is manual. These are acceptable portfolio MVP constraints, not hidden production guarantees.

## Outcome

RestroFlow demonstrates end-to-end React/Next.js and Node.js delivery together with the less visible disciplines expected in operational software: scope isolation, concurrency reasoning, repeatable migrations, safe seeds, deployment boundaries, observability, accessibility, and honest documentation. It is a personally developed, AI-assisted portfolio project; it does not claim commercial customers, revenue, or enterprise availability.
