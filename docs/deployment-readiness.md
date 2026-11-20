# Part 12 deployment readiness audit

Audit date: 2026-11-20. Scope: current local worktree and the selected free providers. This is preparation evidence, not live verification.

| Severity | Finding                                                                         | State after local preparation                                                                                  |
| -------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| BLOCKER  | Render local uploads are ephemeral                                              | Addressed locally with an explicit Cloudinary adapter; external credentials/live upload unverified             |
| BLOCKER  | `SameSite=Lax` cannot support cross-site Vercel-to-Render credentialed requests | Addressed locally with production `SameSite=None; Secure`; real-browser third-party-cookie behavior unverified |
| HIGH     | One URL was used for Neon runtime and Prisma CLI                                | Addressed with pooled `DATABASE_URL` plus direct `DIRECT_URL` selection                                        |
| HIGH     | Proxy trust/rate-limit client IP was not configured                             | Addressed with bounded `TRUST_PROXY_HOPS=1` for Render                                                         |
| HIGH     | No provider build configuration                                                 | Addressed with `render.yaml`, `apps/web/vercel.json`, and exact dashboard documentation                        |
| HIGH     | Effect ReDoS advisory through Prisma tooling                                    | Open pending compatible upstream fix; reduced application reachability, explicit acceptance required           |
| MEDIUM   | Startup did not bind an explicit host or sanitize listen failures               | Addressed with `HOST=0.0.0.0` and fatal startup handling                                                       |
| MEDIUM   | Next.js did not allow Cloudinary/API image origins                              | Addressed with explicit remote image patterns                                                                  |
| MEDIUM   | No production storage/cookie/proxy environment invariants                       | Addressed with fail-fast validation and focused tests                                                          |
| MEDIUM   | Demo data was only a local admin seed                                           | Addressed with a separate guarded, synthetic, non-truncating demo workflow                                     |
| LOW      | CI had no dependency-audit evidence                                             | Audit remains a reporting check; no breaking automatic remediation is allowed                                  |

## Required readiness questions

1. Vercel: the Next.js workspace and shared contracts can build as an npm monorepo. Configure root `apps/web`, include source outside root, Node 24, and `NEXT_PUBLIC_API_URL`.
2. Render: the API compiles to `apps/api/dist/server.js`; the native Node build/start commands in `render.yaml` use the production entry point.
3. Socket.IO: REST and Socket.IO share one HTTP server and Render supports WebSocket upgrades on the service port.
4. Prisma/Neon: Prisma 7 uses the PostgreSQL driver adapter and accepts Neon PostgreSQL URLs.
5. Migrations: all 11 committed migrations can be deployed with the direct URL and `prisma migrate deploy`; no reset/push is needed.
6. TLS: production connection strings must be copied with Neon TLS parameters; no plaintext production URL is documented.
7. Images: production requires Cloudinary; local filesystem remains development-only.
8. Cookies: production uses HTTP-only, secure, `SameSite=None`; live browser policy is the remaining external risk.
9. CSRF/origin: exact frontend origin remains mandatory for all browser mutations.
10. Socket CORS/auth: exact origin plus credentials and cookie handshake are configured; live WSS remains unverified.
11. Environment: production validation now rejects local storage, lax cookies, missing Cloudinary secrets, non-HTTPS web origins, or zero trusted proxy hops.
12. Health/proxy: `/live` is dependency-free; `/ready` checks PostgreSQL; proxy trust is bounded.
13. Headers: Helmet, disabled `x-powered-by`, cross-origin image policy only on local upload assets, and centralized errors remain in place.
14. Next build: configuration is deterministic from lockfile plus `NEXT_PUBLIC_API_URL`; local production build is part of verification.
15. Workspaces: web/API scripts build contracts before their own output; provider commands operate from the monorepo install.
16. CI: Linux/PostgreSQL CI already covers migrations, quality gates, builds, and standard Playwright.
17. Demo: the explicit script is independent from startup and refuses ambiguous target ownership.
18. Advisories: one underlying high Effect advisory remains via Prisma tooling; no critical issue was historically reported, but current `npm audit` must be recorded.

## External configuration and unverified assumptions

- The actual Vercel, Render, Neon, and Cloudinary project identifiers/URLs do not yet exist in this worktree.
- Provider free-plan eligibility, no-card state, and billing/spend settings must be visually confirmed before resource creation.
- Browser acceptance must cover Chrome, Firefox, and Safari with provider-generated cross-site domains.
- Neon migration status, Cloudinary delivery, cold start, and live realtime reconnect are not verified.
- Vercel Hobby is acceptable only for this personal/non-commercial portfolio presentation.

The exact next stage is documented in [deployment.md](./deployment.md). No external action is authorized by this audit.
