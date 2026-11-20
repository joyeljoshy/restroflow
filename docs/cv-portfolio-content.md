# CV, LinkedIn, and portfolio content

## Professional title

RestroFlow — Transaction-Safe Realtime Restaurant Operations Platform

## Two-line description

Built a full-stack restaurant operations portfolio application with Next.js, React, Express, Socket.IO, PostgreSQL, and Prisma. Implemented restaurant-scoped RBAC, idempotent ordering, realtime kitchen workflows, immutable billing, concurrency protection, analytics, and automated CI/browser testing.

## Five CV bullets

- Architected a strict TypeScript npm-workspace monorepo spanning a Next.js 16/React 19 frontend, Express 5 modular API, Prisma 7/PostgreSQL persistence, and shared runtime Zod contracts.
- Implemented staff and customer authentication with Argon2id, opaque HTTP-only sessions, role/restaurant isolation, origin-protected mutations, and authenticated restaurant/customer Socket.IO rooms.
- Designed transactional waiter and QR ordering with server-authoritative pricing, immutable menu snapshots, actor-scoped idempotency keys, optimistic versions, row locks, and audited item/order state transitions.
- Built immutable integer-money billing with tax snapshots, partial cash/manual-UPI records, payment idempotency, concurrent-overpayment prevention, receipts, and timezone-aware operational analytics.
- Established Vitest/Supertest/Playwright coverage, Linux PostgreSQL CI, accessibility checks, load/analytics harnesses, and zero-cost deployment preparation for Vercel, Render, Neon, and Cloudinary.

## Three compact CV bullets

- Built a Next.js/Express/PostgreSQL restaurant operations app with RBAC, QR ordering, KDS realtime updates, billing, and analytics.
- Protected critical writes with transactions, idempotency, optimistic concurrency, row locks, immutable snapshots, and database constraints.
- Delivered strict TypeScript contracts, API/browser tests, CI, accessibility hardening, and free-tier deployment documentation.

## LinkedIn project description

RestroFlow is my full-stack restaurant operations portfolio project, built to explore the reliability problems behind a multi-role workflow—not just the screens. Admins manage menu, staff, and tables; waiters and activated QR customers submit server-priced orders; kitchen users update item preparation in realtime; cashiers finalize immutable bills and record manual payments; managers review timezone-aware analytics.

The stack is Next.js, React, TypeScript, Express, Socket.IO, PostgreSQL, Prisma, Zod, TanStack Query, Zustand, Vitest, Supertest, and Playwright. The implementation emphasizes restaurant isolation, opaque sessions, RBAC, idempotency, snapshots, row locks, optimistic concurrency, integer-money calculations, reconnect recovery, accessibility, CI, and honest free-tier deployment constraints. UPI is manually recorded, not gateway verified.

## GitHub repository description

Full-stack restaurant operations portfolio: Next.js, Express, PostgreSQL/Prisma, Socket.IO, RBAC, idempotent orders, immutable billing, analytics, tests, and CI.

## Case-study introduction

RestroFlow asks what happens when a visually simple restaurant workflow meets retries, simultaneous users, stale screens, tenant boundaries, and financial history. The project combines a polished React interface with the transactional and security controls needed to keep those workflows coherent.

## Technologies to highlight

React 19, Next.js 16 App Router, TypeScript, Node.js 24, Express 5, PostgreSQL 17, Prisma 7, REST, Socket.IO, Zod, TanStack Query, Zustand, React Hook Form, Tailwind CSS, Vitest, Supertest, Playwright, GitHub Actions, Vercel, Render, Neon, Cloudinary.

## Personal contribution

Present the work as end-to-end ownership: requirements decomposition, architecture, schema/migrations, API/service/repository boundaries, frontend workflows, auth/RBAC, concurrency and billing rules, test design, CI, security review, performance harnesses, deployment preparation, and documentation. Do not claim a team, client, or production usage that did not exist.

## Honest AI-assisted development statement

“I used Codex as an AI-assisted engineering tool for repository exploration, implementation drafts, test generation, review checklists, and documentation. I retained responsibility for architecture and scope, inspected generated changes, validated behavior with strict typing and automated tests, verified security/concurrency assumptions against source and official documentation, and rejected unsafe changes such as destructive migrations or breaking dependency downgrades.”
