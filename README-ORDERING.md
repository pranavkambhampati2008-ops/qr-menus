# QR Menus — dine-in ordering setup

## What is included
- Self-service restaurant signup and login at `/restaurant-portal.html`.
- Tenant-separated restaurant profiles, owner memberships and menu item collections.
- Restaurant managers can edit dish names, categories, descriptions, INR prices, image URLs and availability.
- Live customer menu at `/restaurant-menu.html?restaurant=RESTAURANT_ID&table=01`; Firestore listeners publish menu/profile edits to open customer menus in real time.
- Restaurant-specific table QR generator inside the portal.
- Restaurant-specific order dashboard with membership-scoped order access.
- Customer cart and checkout on the existing AURUM menu.
- Table-aware ordering via `?table=04` (optionally `&restaurant=aurum-demo`).
- Server-side item/price validation and Firestore order persistence.
- Pay-at-counter orders.
- Razorpay Checkout with server-side HMAC signature verification.
- Staff order desk at `/staff.html` with live Firestore updates.
- Firestore rules and a script to grant staff access.

## Important deployment boundary
The code is implemented, but it will not accept real orders until the configuration below is completed. No Firebase or Razorpay secrets belong in GitHub. The public Firebase Web API key is not a server secret; the service-account JSON and Razorpay secret are.

## 1. Firebase project setup
1. Open Firebase Console for project `qr-menus-02kmp`.
2. In Project settings, create/register a Web app if one does not already exist. Copy its Web config into `firebase-config.js` (replace the placeholder `apiKey` and `appId`; confirm the auth domain and project ID).
3. Enable **Authentication → Email/Password**.
4. Create a Firestore database if one does not exist.
5. From the repository root, run `npx firebase-tools login` and then `npx firebase-tools deploy --only firestore:rules` (the `.firebaserc` and `firebase.json` files target `qr-menus-02kmp`).
6. In Google Cloud/Firebase service accounts, create a service-account key and store the complete JSON as the Vercel environment variable `FIREBASE_SERVICE_ACCOUNT` for Production and Preview. Never commit this JSON.

## 2. Razorpay setup
1. Create/activate a Razorpay account and enable the required payment methods (including UPI, subject to account approval).
2. Obtain test keys first.
3. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` as Vercel environment variables. Keep the secret server-side only.
4. Test successful, failed, cancelled and delayed payments before switching to live keys.
5. Configure a Razorpay webhook for payment events as a production hardening step; this version verifies the Checkout signature synchronously before marking an order paid.

## 3. Create staff access
1. Create the staff user's Email/Password account in Firebase Authentication.
2. Run the following locally with the service-account JSON in your shell environment:
   `FIREBASE_SERVICE_ACCOUNT='(service-account JSON)' node scripts/set-staff-claim.js staff@example.com`
3. Staff signs in at `https://YOUR-DOMAIN/staff.html`. The staff claim is required to read orders and update order status.

## 4. Table QR format
Open `/qr-codes.html` on the deployed site to generate and download printable table QR codes in batches of up to 50. Each dine-in table must have a distinct QR URL, for example:
- `https://YOUR-DOMAIN/?table=01&restaurant=aurum-demo`
- `https://YOUR-DOMAIN/?table=02&restaurant=aurum-demo`

The existing generic menu QR (without `table`) still displays the menu, but checkout is disabled until the guest scans a table-specific QR. Print and place one unique QR at each table.

## 5. Vercel environment variables
| Variable | Required | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Yes | Firebase Admin server credential JSON |
| `RAZORPAY_KEY_ID` | Online payments | Razorpay public checkout key ID |
| `RAZORPAY_KEY_SECRET` | Online payments | Server-side order creation and signature verification |

After adding or changing environment variables, redeploy the project. The repository's Git integration should deploy the connected branch automatically.

## Restaurant portal and multi-tenant data model

1. Restaurant owners register with email/password and create a restaurant profile.
2. Each restaurant is stored at `restaurants/{restaurantId}`.
3. Owner membership is stored at `restaurants/{restaurantId}/members/{uid}`; the signed-in user's restaurant mapping is stored at `userProfiles/{uid}`.
4. Menu items live at `restaurants/{restaurantId}/menuItems/{itemId}`. The public menu subscribes to Firestore snapshots, so profile and menu edits appear without changing the QR destination.
5. Table QRs point to `/restaurant-menu.html?restaurant={restaurantId}&table={tableId}`.
6. Order creation reads the current Firestore item prices on the server and saves an immutable price/name snapshot in `orders`.

The Firestore rules separate restaurant data by membership. Public users can read only active restaurant profiles and menu items; authenticated restaurant members can access their own workspace and orders. Menu writes are restricted to owner/manager roles. Order status updates are restricted to restaurant members. Admin SDK operations bypass Firestore rules and must remain server-side.

## Current commercial-product boundaries
- This is an MVP partner portal, not yet a hotel-chain enterprise console.
- Signup does not verify legal business ownership or star classification; manually vet pilot hotels before enabling real customer orders.
- Multi-outlet groups, manager invitations, approval workflows, audit history, POS/PMS integrations, custom domains, GST/service-charge configuration and SLA monitoring remain later releases.
- Keep a manual onboarding path for 4- and 5-star hotel procurement teams; they often require vendor registration, security review and operational sign-off.

## Data model
Orders are stored in the top-level Firestore collection `orders`. Each document contains a server-calculated item snapshot, table ID, INR total, payment method/status, order status, and timestamps. Customer browsers cannot read or write order documents directly. Server endpoints use Firebase Admin; staff access is controlled by the `staff: true` custom claim.

## Current scope and limitations
- Dine-in only; no delivery or takeaway.
- One configured restaurant ID (`aurum-demo`) and the existing sample AURUM menu/prices. Replace these with the restaurant's approved live menu before launch.
- GST, service charge, discounts, inventory deductions, kitchen printer integration, customer phone collection, cancellation/refund workflows and webhook reconciliation are not included yet.
- The current static QR can show the menu, but it must be replaced with table-specific QR codes to enable ordering.
- Do not accept real customer payments until the Firebase and Razorpay setup and end-to-end test checklist are complete.
