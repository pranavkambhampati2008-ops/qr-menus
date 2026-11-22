# QR Menus — production readiness gate (pilot release)

Last reviewed: 2026-11-22

## Release definition

This release is a controlled pilot for a small number of independently verified restaurants. It is not a five-star hotel group / POS-integrated enterprise release. Do not accept live customer payments until all P0 gates below pass.

## P0 — blockers before any live pilot

### Platform and configuration
- [ ] Register a Firebase Web App and replace the placeholders in `firebase-config.js`.
- [ ] Enable Firebase Email/Password authentication and email verification.
- [ ] Confirm the Firestore database is provisioned in the intended region.
- [ ] Deploy `firestore.rules` to Firebase project `qr-menus-02kmp`.
- [ ] Add `FIREBASE_SERVICE_ACCOUNT` to Vercel Production and Preview environment scopes.
- [ ] Add Razorpay test credentials to Preview only; do not enable live keys until test sign-off.
- [ ] Configure a production domain, HTTPS, monitoring and a support contact.
- [ ] Confirm Firestore backups / point-in-time recovery and a tested restore procedure.

### Identity, ownership and tenant isolation
- [ ] Require verified email before a restaurant can publish a menu or receive orders.
- [ ] Manually approve restaurant ownership and legal business identity before public listing / live ordering.
- [ ] Separate account approval state from menu publication state. Current MVP uses `status` for active/paused and signup activates immediately; this must not be treated as proof of hotel ownership.
- [ ] Test two unrelated restaurant accounts: each can only see and modify its own profile, menu and orders.
- [ ] Test that a manager cannot promote itself or another account to owner.
- [ ] Add owner-only staff invitations and immediate access revocation before multi-user pilots.

### Order integrity
- [ ] Add server-side idempotency to order creation; browser button disabling alone does not prevent duplicate orders.
- [ ] Add API rate limiting / abuse controls.
- [ ] Validate restaurant, table, item availability, quantity, price and order total on the server.
- [ ] Define order state transitions and prevent invalid state jumps.
- [ ] Add a guest order confirmation / order lookup path that does not expose other guests' data.
- [ ] Test simultaneous submissions, stale carts, sold-out items and network timeouts.

### Payments
- [ ] Test Razorpay test-mode success, failure, cancellation, delayed callback and duplicate callback.
- [ ] Add a signed Razorpay webhook endpoint and idempotent reconciliation; browser Checkout callback alone is not sufficient for production reconciliation.
- [ ] Verify amount, currency, Razorpay order ID and captured payment against the stored order.
- [ ] Add refund / cancellation states and reconciliation procedures before taking real payments.
- [ ] Keep counter payment as the fallback when online payment is unavailable.
- [ ] Never ask a guest to pay again until staff can confirm the previous payment state.

### Operations and observability
- [ ] Add staff alerting for new orders and an escalation path for unaccepted orders.
- [ ] Add structured logs, error monitoring, uptime checks and an incident contact.
- [ ] Add daily export / backup of orders and a documented recovery process.
- [ ] Test a full restaurant service simulation with multiple tables and concurrent orders.
- [ ] Publish support, privacy, terms, cancellation and payment/refund policies.

## P1 — strongly recommended before expanding beyond the first pilots
- Menu preview and publish workflow, audit history and rollback of price changes.
- Persistent carts and explicit price-change confirmation at checkout.
- Password reset, email verification, account recovery and session management UX.
- Table registry (active/inactive tables), QR replacement and table mapping.
- GST / service-charge configuration with transparent itemised totals.
- Allergen and dietary labels with restaurant responsibility notice.
- Image upload/storage with type, size and content validation; avoid arbitrary third-party image URLs.
- Multi-language menus, accessibility review and low-bandwidth handling.
- CSV sales reports, payment reconciliation and menu-performance reports.
- Owner-only staff invitation and role management.
- Guest help / call-staff workflow and order correction/cancellation policy.

## P2 — enterprise hotel roadmap
- Hotel group / multi-property / multi-outlet hierarchy.
- Outlet-specific menus, schedules, pricing, taxes and permissions.
- POS/PMS integration, kitchen display / printer integration and webhooks.
- SSO, audit exports, vendor security pack, SLA, support rota and incident reporting.
- Custom domains, brand templates, procurement and legal onboarding.
- Advanced analytics, inventory / recipe costing and revenue reporting.

## Minimum acceptance test matrix

1. New owner signup, login, logout, email verification and password reset.
2. Owner creates a restaurant, adds dishes, edits prices, pauses/publishes menu.
3. Public QR displays the right restaurant/table; updates appear on an already-open menu.
4. Two tenants are isolated in both browser reads and direct Firestore/API attempts.
5. Sold-out item, stale price, invalid item ID, excessive quantity and excessive total are rejected.
6. Counter order appears exactly once in the correct restaurant dashboard.
7. Online payment success is reconciled exactly once; failed/cancelled/duplicate callbacks do not create paid orders.
8. Unauthorized users cannot read orders, alter menu data, change ownership or change payment state.
9. Mobile Safari/Chrome, Android Chrome, poor network, reload and back-button flows are checked.
10. Backup restore, monitoring alert and manual restaurant fallback procedure are demonstrated.

## Known current release limitations
- Firebase Web configuration is still placeholder in the repository.
- Vercel currently has no configured environment variables for this project.
- Firebase service-account and Razorpay credentials are therefore not configured in the inspected Vercel project.
- No Razorpay webhook endpoint is present.
- Signup currently creates an active restaurant immediately; legal business / hotel ownership is not verified.
- No staff invitation UI, multi-outlet support, POS/PMS integration, GST/service-charge engine, refunds, inventory, audit log or SLA operations.
- Do not merge this branch into production or accept live orders until the P0 gates pass.
