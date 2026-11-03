# Swazei POS Backend

Multi-tenant POS sales & inventory API.
**NestJS 11 · TypeScript · PostgreSQL (TypeORM) · Redis · Jest**

```
Merchant A ── Store A1 (products + stock)      Users belong to stores with a role:
           └─ Store A2                           OWNER | MANAGER | CASHIER
Merchant B ── Store B1
```

## 1. Setup

**Requirements:** Node 20+, PostgreSQL 14+, (optional) Redis 6+. `docker compose up -d` starts both.

```bash
npm install
cp .env.example .env          # then set DB_PASSWORD and JWT_SECRET
docker compose up -d          # skip if you already run Postgres/Redis
npm run migration:run         # creates the schema
npm run seed                  # sample data (see below)
npm run start:dev             # http://localhost:3000/api
```

### Environment (`.env.example`)

| Variable | Purpose |
|---|---|
| `APP_PORT` | HTTP port (default 3000) |
| `DB_HOST/PORT/USERNAME/PASSWORD/NAME` | PostgreSQL connection |
| `DB_LOGGING` | `true` prints every SQL statement |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing (the app refuses to boot without a secret) |
| `TAX_RATE_PERCENT`, `CURRENCY` | Applied to every sale on the server |
| `REDIS_URL` | Enables caching. Empty = caching off, everything still works |
| `TEST_DB_NAME` | Separate DB used by the e2e tests (auto-created, auto-reset) |

### Seed data (password for everyone: `Password@123`)

| User | Access |
|---|---|
| `owner@merchant-a.test` | OWNER of Store A1 and A2 |
| `cashier@merchant-a.test` | CASHIER in Store A1 only |
| `owner@merchant-b.test` | OWNER of Store B1 (a different tenant) |

IDs are fixed (see `src/database/seed-data.ts`) so Postman and tests can reference them.
Merchant A and B both have a `TEA-001` SKU - SKUs are unique *per merchant*, not globally.

### Tests

```bash
npm test            # unit tests (no database needed)
npm run test:e2e    # e2e tests against a real PostgreSQL (creates/reset TEST_DB_NAME)
```

The e2e suite rebuilds its database from the **real migrations** + seed, so migrations are tested too.
It covers the four required scenarios plus concurrency:

| Scenario | Tests |
|---|---|
| Successful & failed sale | totals computed server-side, stock decremented, client-sent price rejected, declined payment stores a `FAILED` sale and leaves stock untouched |
| Insufficient inventory | 409, no sale created, multi-line sale is all-or-nothing |
| Cross-tenant access | other tenant's store → 403, swapped product/sale/inventory IDs → 400/404, cashier role & store limits |
| Duplicate requests | same key → same sale, one stock decrement; parallel duplicates → one sale; different body → 422 |
| *Bonus:* concurrency | stock 5, two sales of 3 → exactly one succeeds; 8 parallel sales of 2 → exactly 2 succeed |

### Postman

Import `postman/swazei-pos.postman_collection.json`, run the folders in order (1 → 6).
Every request carries assertions; the collection passes end-to-end (29 requests / 31 assertions).

## 2. API

All routes are under `/api`. Store routes use `Authorization: Bearer <token>`.

| Method & path | Roles | Notes |
|---|---|---|
| `POST /auth/login` | public | returns JWT |
| `GET /auth/me` | any | |
| `GET /stores` | any | stores the user can access |
| `GET /stores/:storeId/products?search=` | any | includes stock for that store (**Redis-cached**) |
| `POST /stores/:storeId/products` · `PATCH .../:productId` | OWNER, MANAGER | |
| `GET /stores/:storeId/inventory` | any | |
| `POST /stores/:storeId/inventory/adjust` | OWNER, MANAGER | `{productId, mode: SET\|ADD, quantity}` |
| `POST /stores/:storeId/sales` | any | header `Idempotency-Key` required; body `{items:[{productId, quantity}]}` |
| `GET /stores/:storeId/sales` · `.../:saleId` | any | cashiers see only their own sales |

Responses: `201` sale created · `402` payment declined · `409` insufficient stock / request in flight ·
`422` idempotency key reused with a different body · `400` validation · `401/403/404` auth & tenancy.

## 3. Database & schema decisions

`merchants → stores → user_stores ← users`, `merchants → products`, `inventory (store × product)`,
`sales → sale_items`, `sales → payments`, `idempotency_keys`.

* **Every tenant-owned row carries `merchant_id`** (and `store_id` where relevant), so any query can be
  scoped without joins and an index can serve it.
* **Foreign keys** on every relationship (`RESTRICT`, with `CASCADE` for children such as sale items).
* **CHECK constraints** are the last line of defence: `inventory.quantity >= 0`, `price >= 0`,
  `sale_items.quantity > 0`, and enumerated `status`/`role` columns.
* **Unique constraints:** `(merchant_id, sku)`, `(store_id, product_id)` for stock, `(store_id, sale_number)`,
  `(user_id, store_id)`, `(store_id, idempotency_key)`.
* **Indexes** on the access paths: `sales(store_id, created_at)`, `inventory(merchant_id, store_id)`,
  `user_stores(user_id)`, `sale_items(sale_id)`, `payments(sale_id)`.
* **Money** is `numeric(12,2)` in the DB and handled as **integer paise** in code (`src/sales/money.ts`),
  so there are no floating-point errors. Prices are always read from `products`, never from the request.
* **Migrations**, not `synchronize`: `synchronize: false`; the schema lives in `src/database/migrations`.

## 4. Tenant isolation

Defence in depth - an ID in a URL or body is never trusted:

1. `JwtAuthGuard` identifies the user.
2. `StoreAccessGuard` looks up `(user, :storeId)` in `user_stores`. No membership → **403**.
   It also attaches the **merchantId from the database**, not from the request.
3. `RolesGuard` enforces roles (`@Roles('OWNER','MANAGER')`).
4. Every repository query filters by `merchantId` (and `storeId`). A product, sale or stock row from
   another tenant simply isn't found (**404**/**400**), so guessing UUIDs gains nothing.
5. Foreign keys and the composite `(store_id, …)` indexes keep the data itself consistent.

## 5. Transactions & concurrency

Scenario: stock = 5, POS A sells 3 and POS B sells 3 at the same time.

A sale runs in **one PostgreSQL transaction**:

1. load the products (scoped to the merchant, active only);
2. **`SELECT … FOR UPDATE`** the `inventory` rows involved, ordered by product id;
3. check stock, compute prices/tax on the server, insert `sales` + `sale_items`;
4. call the payment provider;
5. success → decrement stock and mark the sale `COMPLETED`; failure → mark it `FAILED`, stock untouched;
6. commit.

POS B blocks on step 2 until POS A commits, then sees the **already-decremented stock (2)** and is rejected
with `409`. Overselling is impossible, and `CHECK (quantity >= 0)` would reject it even if the code had a bug.
Locking in a stable order prevents deadlocks when sales contain several products.
I verified the test is meaningful: removing the `FOR UPDATE` makes both concurrency tests fail.

*Why pessimistic locking?* Contention on a single stock row is the exact case where it is simplest and
most predictable; optimistic retries or `SERIALIZABLE` would add retry loops for the same guarantee.

## 6. Idempotency

POS terminals send an `Idempotency-Key` header (e.g. a UUID generated once per sale attempt and reused on retry).

* The key is stored in `idempotency_keys` with a **SHA-256 of the request**, unique per `(store, key)`.
* First request: inserts a `PROCESSING` row (the unique index makes this race-safe), does the sale, and
  marks the key `COMPLETED` **inside the same transaction** that creates the sale. Key and sale commit atomically.
* Retry with the same key and body → the **original sale is returned** (`replayed: true`); no second sale, no second stock decrement.
* Same key, **different body** → `422`. Same key while the first is still running → `409`.
* After a declined payment or other failure the key becomes `FAILED` and a retry is allowed
  (a compare-and-set update makes sure only one concurrent retry wins).
* A key stuck in `PROCESSING` for over 2 minutes (crashed process) can be retried.

## 7. Payments

`PaymentProvider` is an interface (`src/payments/payment-provider.interface.ts`) bound to a DI token.
`MockPaymentProvider` simulates `SUCCESS` or `FAILED` (send `"simulatePayment": "FAILED"` in the sale body;
real providers ignore this field). `PaymentsService` also converts a provider crash into a `FAILED` result.
Sales code never imports a concrete provider - to add Razorpay/Stripe, implement the interface and change
one line in `PaymentsModule`.

## 8. Redis caching

**Choice:** caching for the product list (`GET /stores/:storeId/products`) - the read-heavy call every POS
screen makes, while writes (sales, stock changes) are comparatively rare.

* Key: `plist:{storeId}:{merchantVersion}:{storeVersion}:{search}`, TTL 60 s.
* **Invalidation by version counters:** product create/update bumps `ver:m:{merchantId}`; a sale or stock
  adjustment bumps `ver:s:{storeId}`. Stale entries become unreachable immediately (and expire on their own);
  no key scanning/deleting is needed.
* **Fails open:** if `REDIS_URL` is unset or Redis is down, requests go straight to PostgreSQL (verified).
* Stock is correct after a sale because the sale bumps the store version after commit.

## 9. Assumptions & trade-offs

* **Payment inside the DB transaction.** The mock is instant, so holding row locks during `charge()` is fine.
  With a real gateway I would do *reserve stock → commit → charge → confirm/release* (or use the outbox pattern
  with the queue) to avoid holding locks during a network call.
* A declined payment stores a `FAILED` sale for auditing but does not reserve stock.
* Idempotency keys are scoped per store and never expire; production would add a cleanup job.
* One flat tax rate from config; no discounts, refunds, cancellations or multi-currency.
* Products are merchant-wide with per-store stock; a store without a stock row has quantity 0.
* No self-registration API: users/stores/merchants are created by seed (admin APIs were out of scope).
* Cache staleness is bounded by invalidation + a 60 s TTL; price changes show up immediately via the merchant version.
* `@nestjs/config`, `jwt`, `passport`, `typeorm` are on their CommonJS v11/v4 lines so Jest can load them.

## 10. Project layout

```
src/
  auth/        JWT, StoreAccessGuard, RolesGuard
  stores/ products/ inventory/ sales/ payments/   controller → service → repository
  cache/       Redis wrapper (fails open)
  common/      global exception filter (no internals leak)
  database/    entities, migrations, seed
test/          e2e tests + helpers
postman/       collection
```
