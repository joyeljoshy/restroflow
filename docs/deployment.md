# Free deployment guide

Status: local preparation only. Target monthly cost: ₹0 / $0. The allowed services are Vercel Hobby, Render Free Web Service, Neon Free, Cloudinary Free, and GitHub Free. Do not add a card, paid disk, paid database, paid domain, usage-based upgrade, Redis, or an automatic production migration.

Current official references: [Vercel Hobby/plan behavior](https://vercel.com/docs/plans), [Vercel personal/non-commercial terms](https://vercel.com/legal/terms), [Vercel monorepos](https://vercel.com/docs/monorepos/monorepo-faq), [Render Free limitations](https://render.com/docs/free), [Render WebSockets](https://render.com/docs/websocket), [Render health checks](https://render.com/docs/health-checks), [Neon/Prisma connection guidance](https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md), [Cloudinary plans](https://cloudinary.com/documentation/billing_and_plans), and [authenticated upload guidance](https://cloudinary.com/documentation/upload_images).

## Target topology

```text
Vercel HTTPS frontend
  -> Render HTTPS REST API
  -> Render WSS Socket.IO
Render -> Neon pooled TLS PostgreSQL
Render -> Cloudinary signed image upload
Browser -> Cloudinary HTTPS delivery
```

The generated Vercel and Render domains are different sites. Production cookies therefore use `Secure; HttpOnly; SameSite=None`, exact credentialed CORS, and origin validation. This design must pass real-browser third-party-cookie testing before acceptance.

## Environment matrix

| Variable                 | Location/class               | Secret                  | Production value/meaning                             |
| ------------------------ | ---------------------------- | ----------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`    | Vercel build/public          | No                      | Actual Render HTTPS origin, no trailing path         |
| `NODE_ENV`               | Render runtime               | No                      | `production`                                         |
| `PORT`                   | Render runtime               | No                      | Provider-managed; do not hardcode                    |
| `HOST`                   | Render runtime               | No                      | `0.0.0.0`                                            |
| `LOG_LEVEL`              | Render runtime               | No                      | `info`                                               |
| `CORS_ORIGINS`           | Render runtime               | No                      | Exact actual Vercel HTTPS origin(s), comma-separated |
| `PUBLIC_WEB_ORIGIN`      | Render runtime               | No                      | Actual Vercel HTTPS origin used in QR links          |
| `DATABASE_URL`           | Render database              | Yes                     | Neon pooled TLS URL (`-pooler` hostname)             |
| `DIRECT_URL`             | Migration environment only   | Yes                     | Neon direct TLS URL (no `-pooler`)                   |
| `SESSION_TTL_HOURS`      | Render runtime               | No                      | Default `12` unless deliberately changed             |
| `LOGIN_RATE_LIMIT_MAX`   | Render runtime               | No                      | Default `5`                                          |
| `COOKIE_SAME_SITE`       | Render runtime               | No                      | `none`                                               |
| `TRUST_PROXY_HOPS`       | Render runtime               | No                      | `1`                                                  |
| `IMAGE_STORAGE_PROVIDER` | Render runtime               | No                      | `cloudinary`                                         |
| `CLOUDINARY_CLOUD_NAME`  | Render image storage         | Treat as private config | Cloudinary product environment name                  |
| `CLOUDINARY_API_KEY`     | Render image storage         | Yes                     | Backend-only key                                     |
| `CLOUDINARY_API_SECRET`  | Render image storage         | Yes                     | Backend-only secret                                  |
| `CLOUDINARY_FOLDER`      | Render image storage         | No                      | `restroflow/menu`                                    |
| `MENU_IMAGE_DIRECTORY`   | Local development only       | No                      | `uploads/menu`; unused with Cloudinary               |
| `DEMO_SEED_*`            | One-time approved seed shell | Yes/mixed               | Never API runtime or Vercel variables                |

Never paste secrets into documentation, screenshots, Git, `NEXT_PUBLIC_*`, or provider build logs.

## Vercel Hobby settings

Prerequisite gate: approve connecting the GitHub and Vercel accounts. Then import the repository as one Vercel project with:

- Plan: Hobby; verify it remains $0 and the use is personal/non-commercial.
- Root Directory: `apps/web`.
- Enable “Include source files outside of the Root Directory in the Build Step” so `packages/contracts` and the root lockfile are available.
- Framework: Next.js.
- Node.js: 24.x (consistent with `.nvmrc` and package engines).
- Install command: default `npm install`/lockfile-aware workspace install; do not install only `apps/web` dependencies.
- Build command: `npm run build` (also recorded in `apps/web/vercel.json`).
- Output: framework default `.next`; do not override.
- Environment: only `NEXT_PUBLIC_API_URL=https://<actual-render-service>.onrender.com` after the Render URL exists.
- Git auto-deploy: leave disabled until the separate Git/deployment approval. Preview deployments also require their exact origins in Render CORS if they need authenticated API access.

Do not add `DATABASE_URL`, Cloudinary secrets, seed passwords, or session material to Vercel.

## Render Free settings

`render.yaml` defines a single native Node service and intentionally disables auto-deploy. After the account/resource gates are approved, verify:

- Type: Web Service; runtime Node; plan Free; one instance; no disk.
- Repository root: repository root (the API depends on root lockfile/contracts).
- Build: `npm ci && npm run build -w @restroflow/api`.
- Start: `npm run start -w @restroflow/api`.
- Health path: `/api/v1/health/live`.
- Auto-deploy: off.
- Required environment: the matrix above.

Do not put `npm run db:migrate:deploy` in start/build. Render Free does not provide the paid pre-deploy command, and migrations require an explicit database approval anyway.

Render Free currently spins down after 15 minutes without inbound HTTP requests or WebSocket messages, can take about a minute to wake, may restart, supplies 750 workspace free instance-hours/month, and has an ephemeral filesystem. It can suspend instead of charging if no payment method is present when certain included usage is exhausted; confirm dashboard billing/spend behavior. Do not create keep-alive traffic to evade sleep. Socket clients must expect disconnect/reconnect, and REST refetch remains authoritative.

## Neon Free and migration procedure

After the database-creation gate is approved:

1. Create one Neon Free project/branch/database and record its exact project ID, branch, database, role, region, and environment designation (`production-demo`). Verify $0/no card in the dashboard.
2. Copy the pooled URL for Render runtime and the direct URL for migration tooling. Both must use TLS parameters from Neon. Do not expose either value.
3. Before any write, present this gate record:
   - exact Neon project/branch/database/role;
   - environment `production-demo`;
   - all 11 migration directory names from [database.md](./database.md);
   - command `npm run db:migrate:deploy` with one direct URL set securely;
   - writes: yes, migration tables/schema will change;
   - backup: export/restore method and Free-plan history limitation;
   - rollback: restore to a new verified branch/database or apply a reviewed forward migration; never edit applied SQL.
4. Wait for explicit production database approval.
5. In an approved, disposable secure shell or provider job, inject the reviewed direct Neon TLS URL as exactly one of `DIRECT_URL` or `DATABASE_URL_UNPOOLED`. Clear test variables. The pooled runtime `DATABASE_URL` is optional here and, if supplied, must identify the same Neon endpoint and database. Set both flags only for the approved invocation. Keep them out of persistent environment files and all build/start jobs.

   ```powershell
   $env:PRISMA_DATABASE_MODE = 'production'
   $env:PRISMA_PRODUCTION_MIGRATION_CONFIRM = 'APPLY_REVIEWED_PRODUCTION_MIGRATIONS'
   try {
     npm run db:migrate:deploy
     if ($LASTEXITCODE -ne 0) { throw 'Production migration failed' }
     npm run db:migrate:deploy -- --status
     if ($LASTEXITCODE -ne 0) { throw 'Production migration status check failed' }
   } finally {
     Remove-Item Env:PRISMA_DATABASE_MODE, Env:PRISMA_PRODUCTION_MIGRATION_CONFIRM
   }
   ```

   To check status separately, use `npm run db:migrate:deploy -- --status` with the same approval flags and direct URL. A nonzero status can mean pending migrations or a failure. Inspect the state through the approved secure workflow before proceeding.

6. If migration fails, stop. The wrapper reports the target class and exit status. Use the approved secure database workflow to inspect migration state, then decide on restore or forward repair before retrying.
7. Confirm `/api/v1/health/ready` only after the Render runtime uses the pooled URL.

## Cloudinary Free

After account/resource approval, create one Free product environment with no payment method. Confirm the current Free allowance in Cloudinary’s console; official documentation currently describes no-card signup and 25 monthly credits shared across storage, transformations, and bandwidth.

Place cloud name/key/secret only in Render. The API performs authenticated server-side `upload_stream` calls after MIME, size, and signature validation. Public IDs are UUIDs under `restroflow/menu`. No unsigned upload preset is required. Do not bulk-migrate or delete existing local images.

Operational policy: review usage monthly, compress/rescale demo source images before upload, avoid unnecessary transformations, and review orphaned assets manually. Delete only confirmed unreferenced demo assets after explicit approval. Quota exhaustion should disable new uploads/fail cleanly; it must never trigger a paid upgrade.

## Demo seed approval and command

Recommended access strategy: share role credentials selectively with recruiters. Do not publish an unrestricted admin password. This preserves normal RBAC without a special demo mode. Use synthetic data only and rotate credentials after a review window.

Before the first Neon demo seed, present the exact database target and obtain the production write approval. Set the five distinct passwords securely in the shell/provider interface, not chat. Required variables:

```text
DEMO_SEED_DATABASE_LABEL=<exact Neon project/branch/database>
DEMO_SEED_ENVIRONMENT=production-demo
DEMO_SEED_CONFIRM=CREATE_THE_URBAN_TABLE
DEMO_SEED_ADMIN_PASSWORD=<secret 16+ chars>
DEMO_SEED_MANAGER_PASSWORD=<different secret>
DEMO_SEED_WAITER_PASSWORD=<different secret>
DEMO_SEED_KITCHEN_PASSWORD=<different secret>
DEMO_SEED_CASHIER_PASSWORD=<different secret>
```

Run `npm run db:seed:demo` once from an approved secure environment. The script logs the database label and never prints credentials. It refuses a conflicting `the-urban-table-demo` slug and does not truncate or delete. Re-running is an upsert/credential rotation, not a cleanup reset.

## Live verification after public-deployment approval

Use synthetic data and the actual URLs to verify landing/assets, liveness/readiness, staff login/protected routes, Cloudinary images, tables/QR, customer activation/order, kitchen realtime, reconnect recovery, serving, billing, manual partial/full payment, receipt, table close, analytics, cross-role/restaurant/customer denial, sanitized logs, Vercel reload/navigation, Render cold start, and zero billing exposure. Do not run destructive cleanup against production.

## Mandatory approval gates

Each request must name action, exact target, result, cost, risks, recovery, and a specific question. Separate approvals are required for:

1. Connecting GitHub/Vercel/Render/Neon/Cloudinary accounts.
2. Creating each persistent cloud resource.
3. Any billing, card, paid plan, or usage-based exposure (the expected answer for this architecture is no).
4. Neon migrations, seeding, data changes, or database settings.
5. Public deployment/access.
6. Publishing demo credentials.
7. Deletion/reset/replacement.
8. Git commit/push, visibility, releases, settings, or automatic deployment.

## Cost and acceptance state

Expected configured recurring price: ₹0 / $0, subject to confirming each dashboard remains on the named Free/Hobby plan without payment exposure. Free usage limits can suspend service; “free” does not mean unlimited or always available.

Completed locally: code/configuration, templates, tests, manifests, migration workflow, demo seed, and documentation. Ready after local checks: provider configuration entry. Awaiting approval: every external connection/resource/write/public/Git action. Verified live: nothing yet.
