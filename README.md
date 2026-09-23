# Orbistore backend

Express 5, MongoDB/Mongoose, Zod 4, JWT cookie authentication, bcrypt, and Stripe.
This repository implements the API, not a storefront, cart UI, search engine, or Cloudinary upload integration.

## Setup

Use Node.js 22.19 or newer and a MongoDB replica set or sharded cluster (Atlas works).
Standalone MongoDB is rejected because checkout and stock release require transactions.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and supply your database URI and Stripe test credentials.
3. Generate a JWT secret: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
4. Set `CLIENT_URL` to the exact frontend origin, without a trailing slash.
5. Run `npm run dev` (development) or `npm start`.

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
The .env file is ignored by Git. Never commit credentials.

Startup validates configuration, connects to MongoDB, checks existing email data,
creates collections and indexes, then opens the HTTP listener. SIGINT/SIGTERM trigger
graceful shutdown. Importing `src/app.js` does not connect to the database.

## Configuration

| Variable | Meaning |
| --- | --- |
| NODE_ENV | development, test, or production |
| PORT | Integer 1–65535; default 4400 |
| DATABASE_URL | MongoDB URI; must point to a transaction-capable deployment |
| JWT_SECRET | Random secret, at least 32 characters |
| JWT_EXPIRES_IN_SECONDS | Token and cookie lifetime; default 3600 |
| CLIENT_URL | Exact HTTP(S) frontend origin; production requires HTTPS |
| STRIPE_SECRET_KEY | sk_test/sk_live or restricted Stripe server key |
| STRIPE_WEBHOOK_SECRET | Webhook endpoint signing secret |
| COOKIE_SAME_SITE | lax (default), strict, or none; none requires production HTTPS |
| TRUST_PROXY | Empty for direct connections; otherwise explicit comma-separated trusted proxy IPs/subnets |
| RATE_LIMIT_STORE | mongo (default and required in production); memory is for local tests/development |
| RESERVATION_MINUTES | 1–120; default 30 |

`JWT_EXPIRES_IN` and `MONGODB_URI` are not used. Use the names above.
Use the same MongoDB database across replicas to share rate limits.
The reverse proxy must overwrite forwarded headers and match TRUST_PROXY.
Do not set broad trusted subnets without understanding the actual network.

Cookies are HttpOnly, Secure in production, and scoped to /.
The frontend must send credentials with requests.
Every POST/PUT/PATCH/DELETE API request must include `Origin: <CLIENT_URL>`;
this includes curl/server clients and login/logout. Stripe webhooks are exempt
and protected by signature verification over the raw request body.
CORS alone is not the CSRF defense.

## Routes

| Method/path | Behavior |
| --- | --- |
| GET /health | Liveness, independent of DB |
| GET /ready | 200 connected; 503 disconnected |
| POST /api/auth/register | Register; name/email/password/optional avatarUrl |
| POST /api/auth/login | Set auth_token cookie |
| POST /api/auth/logout | Clear cookie |
| GET /api/products | Public paginated list |
| GET /api/products/:id | Public product detail |
| POST /api/products | Admin create, strict validated fields |
| PUT /api/products/:id | Admin partial update; unknown fields/operators rejected |
| DELETE /api/products/:id | Admin deletion by exact ID |
| POST /api/orders | Authenticated order creation |
| GET /api/orders/myorders | Owner's paginated orders |
| GET /api/orders | Admin paginated orders |
| PUT /api/orders/:id | Admin fulfillment transition |
| POST /api/orders/:id/cancel | Owner cancellation/restocking |
| POST /api/payments/create-intent | Owner's Stripe intent |
| POST /api/payments/webhook | Signed Stripe event handler |

Lists accept `?page=1&limit=20`, maximum limit 100. Responses remain arrays.
Admin fulfillment uses `{ "fulfillmentStatus": "processing" }`, followed by
`shipped`, then `delivered`. Only paid orders can advance. Direct paymentStatus
updates are rejected; verified Stripe events control payment state.

## Order prices, stock, and payments

Send only product IDs and quantities:

```json
{
  "items": [
    { "product": "507f1f77bcf86cd799439011", "quantity": 2 }
  ]
}
```

Zod permits 1–100 distinct products and integer quantities from 1–1000.
Client prices/totals/currency/pricing markers are ignored.
Catalog price remains a USD dollar number with at most two decimal places.
The server stores priceMinor/totalMinor as integer cents, snapshots catalog prices,
and sends cents directly to Stripe. The existing price/total fields are display dollars.
The supported order range is $0.50–$999,999.99.

Stock is conditionally deducted and the order persisted in one transaction.
A failed transaction rolls back all deductions; concurrent orders cannot oversell.
Paid orders do not deduct stock again.

The server scans for expired reservations every minute in bounded batches.
Cancellation/expiry first blocks payment creation, cancels any Stripe intent,
then restores stock and marks canceled in one transaction. Retried/concurrent
cancellations restock once. A product deleted meanwhile is not recreated.
A paid or currently uncancelable Stripe payment retains its stock until reconciled.

Payment creation checks ownership, state, reservation expiry, and amount consistency.
It reuses existing intents, uses a deterministic idempotency key, persists an attempt
timestamp before Stripe, and links the intent with a conditional database update.
If a request crashes before linking, expiry can replay the identical Stripe request
within the safe key window and cancel the recovered intent.

Ambiguous requests older than 23 hours block new intent creation and stock release.
This deliberately requires operator reconciliation rather than risking another charge
after Stripe's idempotency key expires:

```sh
node scripts/reconcile-payment.js ORDER_ID pi_EXISTING_INTENT
node scripts/reconcile-payment.js ORDER_ID pi_EXISTING_INTENT --apply
```

The command only verifies/links an existing matching Stripe intent; it never creates
one. Confirm the intent in Stripe first. Escalate genuinely unresolved payments
rather than blindly editing order totals or stock.

Webhook updates verify reference, amount, currency, and amount received.
Duplicate successes are harmless; late failures cannot downgrade paid.
Persistence failure returns non-2xx so Stripe retries. Configure the endpoint for
payment_intent.succeeded and payment_intent.payment_failed. Use Stripe CLI test
events and an end-to-end test payment before deploying; no live payment was made
during the local verification.

## Existing data and compatibility

- Legacy client-priced orders must be recreated; old Stripe intents are not automatically canceled.
- Existing normalized duplicate emails require a manual ownership decision. Startup refuses to proceed.
- Run `npm run db:emails` to check duplicates. After resolving them, run
  `npm run db:emails -- --apply` during maintenance to normalize emails and ensure the unique index.
  The script does not merge/delete users. Stop writers during migration.
- Passwords are limited to 72 UTF-8 bytes, matching bcrypt. Previously accepted
  overlong passwords need an account recovery process; this backend does not yet
  include a password-reset email flow.
- avatarUrl is now persisted. Empty/whitespace values become an empty string;
  null is accepted and stored as empty.
- The local JWT secret was strengthened during the review; existing local sessions need re-login.
- Admin order status requests must use fulfillmentStatus, not paymentStatus.
- Cross-origin frontend requests must send credentials and the configured Origin.

## Verification

```sh
npm run check
npm run test:integration
npm audit
```

check runs ESLint, JavaScript/JSDoc type checking, and unit/HTTP tests.
test:integration starts and tears down a disposable MongoDB replica set, and uses
mocked Stripe calls. It never connects to the database in your .env.
The first integration run may download a MongoDB binary (version 8.2.6).

Integration coverage includes bootstrap/index creation, transactional rollback,
stock contention, duplicate users, concurrent checkout, webhook persistence retries,
early/duplicate/out-of-order events, cancellation, reservation expiry, and shared counters.
See PROJECT_REVIEW.md for each original finding and its resolution.

The application does not yet implement storefront/cart UI, uploads, refunds,
password-reset emails, taxes, shipping charges, or an operator dashboard.
