# Database design and operations

PostgreSQL is RestroFlow's authoritative store. Prisma owns the schema, generated client, and committed migration history; `@prisma/adapter-pg` provides runtime connectivity.

## Core model groups

- Identity: `User`, `StaffMembership`, `Session`.
- Restaurant/menu: `Restaurant`, `MenuCategory`, `MenuItem`, `ModifierGroup`, `Modifier`, `MenuItemModifierGroup`.
- Tables/customer access: `RestaurantTable`, `TableSession`, `TableOrderingActivation`, `CustomerOrderingSession`.
- Ordering: `Order`, `OrderItem`, `OrderItemModifier`, status history, `IdempotencyKey`.
- Billing: `Bill`, `BillItem`, `BillItemModifier`, `Payment`, `PaymentIdempotency`.

Restaurant IDs are repeated in operational tables and compound relations to make scope explicit. Unique and partial indexes enforce one open session per table, unique restaurant order/bill numbers, and actor-scoped idempotency keys. Check constraints cover positive quantities, non-negative integer money, valid versions, lifecycle/date consistency, idempotency hashes/expiry, tax range, and bill status/balance agreement.

## Financial and historical integrity

Menu values are mutable configuration, so each order snapshots item/modifier names and prices. A finalized bill then snapshots order numbers, line values, modifiers, tax configuration, currency, and rounding policy. Later menu or restaurant-setting changes do not rewrite history.

Order creation, add-item commands, status aggregation, bill finalization, payment recording, and table closure use transactions. Row locks serialize operations that could otherwise overpay a bill, finalize twice, append after finalization, or close a session while work remains. Optimistic `version` comparisons reject stale UI updates.

## Migration history

The repository contains 11 ordered migrations:

1. `20261118120226_add_staff_authentication`
2. `20261118140953_restaurant_staff_management`
3. `20261118163000_add_menu_management`
4. `20261119090000_add_table_management`
5. `20261119100000_add_transactional_orders`
6. `20261119101000_add_order_invariants`
7. `20261119140000_add_kitchen_item_history`
8. `20261119180000_add_customer_qr_ordering`
9. `20261119181139_add_billing_payments`
10. `20261119181225_enforce_billing_invariants`
11. `20261120120000_add_analytics_query_indexes`

Applied migrations are never edited or replaced. Development changes use `npm run db:migrate -- --name <descriptive_name>`, followed by SQL review. Production applies committed SQL with `npm run db:migrate:deploy` only after the documented database approval gate.

## Database target selection

The Prisma CLI config does not load dotenv. Guarded commands validate the current process environment and pass the validated URL to Prisma. There is no URL precedence chain.

| Operation                                                    | Required target                                                                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Development migrations, Studio, ordinary seed                | Explicit loopback `DATABASE_URL`; clear any conflicting direct URL variables.                                                                                                                       |
| Test migrations, database integration tests, opt-in live E2E | `RUN_DATABASE_INTEGRATION_TESTS=1` and an explicit `TEST_DATABASE_URL` on `localhost`, `127.0.0.1`, or `::1`, with `test` in the database name. Any other supplied database URL must match exactly. |
| Approved production migrations and status                    | Set both approval variables from the [deployment runbook](./deployment.md#neon-free-and-migration-procedure). Supply exactly one direct Neon URL through `DIRECT_URL` or `DATABASE_URL_UNPOOLED`.   |

For local integration tests, start a disposable PostgreSQL container bound only to loopback with a separate database such as `restroflow_test`. In a fresh shell, set its URL as `TEST_DATABASE_URL` and set `RUN_DATABASE_INTEGRATION_TESTS=1`. Run `npm run db:migrate:test`, then `npm test`. The live browser suites additionally require their individual `REAL_*_E2E` flag. Clear stale or conflicting variables from the current shell and re-export only values for the isolated target if validation fails. Keep local credentials out of shell history and source control.

The production API still uses the pooled Neon `DATABASE_URL` for runtime. If present in a production migration shell, it must refer to the same endpoint and database as the direct URL. Use the TLS connection settings supplied by Neon. The host classifier cannot establish which Neon branch is authorized, and a loopback address alone cannot rule out a tunnel. Verify the service and database through the approved runbook before enabling writes. Use the repository scripts for migration and seed operations. Invoking Prisma directly with explicit CLI URL or config overrides is outside these guards.

Neon Free can scale compute to zero and has plan-specific storage/compute/history limits. Connection wake-up and plan limits must be verified in the provider dashboard at deployment time. Free-plan history is not a substitute for an independently verified backup/export.

## Seeds

`npm run db:seed` verifies connectivity and writes nothing unless every local development-admin variable is supplied; that optional admin path is disabled in production.

`npm run db:seed:demo` is separate and never runs during build/start. It uses one stable sentinel restaurant ID/slug, refuses a slug owned by another record, never truncates data, requires an explicit environment label/confirmation plus five distinct 16+ character passwords, and prints no credentials. It prepares synthetic restaurant, staff, menu, modifiers, tables, open/closed sessions, lifecycle/audit history, bills, and manual payment records. Existing unrelated restaurants are untouched.

Because the demo script writes data, running it against Neon requires the production database approval gate in [deployment.md](./deployment.md). Re-running updates demo credential hashes and upserts stable fixtures; it is not a reset mechanism and does not delete recruiter-created demo records.
