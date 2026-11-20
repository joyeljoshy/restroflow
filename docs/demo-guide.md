# Recruiter demo and screenshot guide

## Safe demo strategy

Use the synthetic “The Urban Table” fixture and share restricted credentials selectively with a recruiter. Do not publish an admin password in the repository or public website. Use distinct role passwords, rotate them after a review window, and never reuse personal credentials. The fixture contains no real customer data.

The explicit seed is described in [deployment.md](./deployment.md). It never runs at startup, never truncates another restaurant, and requires the exact target label plus confirmation. Do not create a reset endpoint or weaken RBAC for the demo. If public abuse becomes a problem, disable the service or rotate/revoke credentials; any data cleanup requires an explicit scoped approval.

Before presenting, wake the Render service with the liveness URL, wait for readiness, sign in to each role in separate browser profiles, and verify customer QR access in a mobile viewport. Explain the cold start honestly rather than hiding it with keep-alive traffic.

## Two-minute manual path

1. Admin: show restaurant settings, menu/modifiers, staff roles, and rotatable table QR.
2. Waiter: open a table, issue an activation code, and submit an order (or use the prepared active fixture).
3. Customer: activate from the table menu, add customized items, submit, and open order tracking.
4. Kitchen: accept/prepare/ready item statuses; point out the other screen updating after a scoped invalidation/refetch.
5. Waiter: serve the completed order.
6. Cashier: preview/finalize the immutable bill, record a manual partial/full payment, show the receipt, and close the session when paid.
7. Admin/Manager: show analytics definitions and timezone-aware range controls.

Keep the browser network stable. If a socket disconnects, use it to demonstrate the reconnect indicator and REST recovery.

## Screenshot checklist

No screenshot files are committed yet, so the README intentionally references none. Capture the real running application only after the demo fixture and provider URLs are verified.

|   # | Screen               | Preparation and framing                                                        |
| --: | -------------------- | ------------------------------------------------------------------------------ |
|   1 | Landing page         | Desktop 1440×900; show product statement and role entry points                 |
|   2 | Login                | Empty form, no password manager overlay or credentials                         |
|   3 | Admin dashboard      | Synthetic restaurant name and navigation; avoid internal IDs                   |
|   4 | Staff management     | Show fictional accounts/roles only; obscure email if credentials are public    |
|   5 | Menu management      | Show categories, prices, modifiers, and real persisted demo images if uploaded |
|   6 | Tables and QR        | Show table state and QR graphic; use only the synthetic demo table             |
|   7 | Waiter POS           | Open table, item customization, cart, and order history                        |
|   8 | Kitchen tickets      | Multiple item statuses and reconnect indicator                                 |
|   9 | Customer mobile menu | 390×844 viewport with categories and item card                                 |
|  10 | Customer tracking    | Confirmed order progress; no cookie/devtools panels                            |
|  11 | Cashier billing      | Preview/finalized bill and outstanding balance                                 |
|  12 | Printable receipt    | Print preview with manual payment wording visible                              |
|  13 | Analytics            | KPIs and charts from synthetic history; include selected date range            |

Use PNG for UI text clarity. Suggested names are `docs/screenshots/01-landing.png` through `13-analytics.png`, but add README references only after every referenced file exists. Capture one consistent browser/theme, hide bookmarks/extensions, disable notifications, and crop unnecessary browser chrome.

Before saving each image, inspect for passwords, activation codes, raw QR identifiers, session cookies, authorization headers, database/provider identifiers, Cloudinary secrets, real names/contact details, log output, and devtools. Do not fabricate or composit app screenshots.

## Live acceptance checklist

- Both liveness and readiness succeed after cold start.
- Staff/customer cookies authenticate over HTTPS in Chrome, Firefox, and Safari.
- Untrusted origin and wrong-role/cross-restaurant/cross-customer attempts are denied.
- Uploaded images survive Render sleep/redeploy because their URLs point to Cloudinary.
- Customer, waiter, kitchen, and cashier screens reconcile after forced socket reconnect.
- Manual UPI wording is accurate; no gateway claim appears.
- Render/Vercel/Neon/Cloudinary dashboards show the intended free plans and no billing exposure.
