import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Inventory, Payment, Sale } from '../src/database/entities/pos.entities';
import { SEED } from '../src/database/seed-data';
import { resetTestDatabase } from './helpers/db';

describe('POS backend (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let ownerA: string;
  let cashierA: string;
  let ownerB: string;

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  let keySeq = 0;
  const newKey = () => `test-key-${Date.now()}-${keySeq++}`;

  const login = async (email: string) =>
    (await api().post('/api/auth/login').send({ email, password: SEED.password }).expect(201)).body
      .accessToken as string;

  const setStock = (storeId: string, productId: string, quantity: number) =>
    ds.getRepository(Inventory).update({ storeId, productId }, { quantity });
  const stockOf = async (storeId: string, productId: string) =>
    (await ds.getRepository(Inventory).findOneOrFail({ where: { storeId, productId } })).quantity;
  const salesCount = (storeId: string) => ds.getRepository(Sale).count({ where: { storeId } });

  const sell = (
    token: string,
    storeId: string,
    items: { productId: string; quantity: number }[],
    opts: { key?: string; simulatePayment?: 'SUCCESS' | 'FAILED' } = {},
  ) =>
    api()
      .post(`/api/stores/${storeId}/sales`)
      .set(auth(token))
      .set('Idempotency-Key', opts.key ?? newKey())
      .send({ items, ...(opts.simulatePayment ? { simulatePayment: opts.simulatePayment } : {}) });

  beforeAll(async () => {
    await resetTestDatabase();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    ds = app.get(DataSource);

    ownerA = await login(SEED.ownerA.email);
    cashierA = await login(SEED.cashierA.email);
    ownerB = await login(SEED.ownerB.email);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await setStock(SEED.storeA1, SEED.teaA, 10);
    await setStock(SEED.storeA1, SEED.coffeeA, 5);
  });

  // ------------------------------------------------------------------
  describe('1. Successful and failed sale', () => {
    it('creates a sale with server-side prices and decrements stock', async () => {
      const res = await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 2 }]).expect(201);

      expect(res.body.replayed).toBe(false);
      expect(res.body.sale.status).toBe('COMPLETED');
      // 2 x 20.00 = 40.00, 5% tax = 2.00
      expect(res.body.sale.subtotal).toBe('40.00');
      expect(res.body.sale.tax).toBe('2.00');
      expect(res.body.sale.total).toBe('42.00');
      expect(res.body.sale.payments[0]).toMatchObject({ provider: 'MOCK', status: 'SUCCESS' });
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(8);
    });

    it('rejects a client-supplied price (prices come only from the server)', async () => {
      await api()
        .post(`/api/stores/${SEED.storeA1}/sales`)
        .set(auth(ownerA))
        .set('Idempotency-Key', newKey())
        .send({ items: [{ productId: SEED.teaA, quantity: 1, price: '0.01' }] })
        .expect(400);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(10);
    });

    it('stores a FAILED sale + FAILED payment and leaves stock untouched when payment fails', async () => {
      const res = await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 3 }], {
        simulatePayment: 'FAILED',
      }).expect(402);

      expect(res.body.message).toBe('Payment failed');
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(10);

      const sale = await ds.getRepository(Sale).findOneOrFail({ where: { id: res.body.saleId } });
      expect(sale.status).toBe('FAILED');
      const payment = await ds.getRepository(Payment).findOneOrFail({ where: { saleId: sale.id } });
      expect(payment.status).toBe('FAILED');
    });
  });

  // ------------------------------------------------------------------
  describe('2. Insufficient inventory', () => {
    it('rejects the sale with 409 and creates nothing', async () => {
      const before = await salesCount(SEED.storeA1);
      const res = await sell(ownerA, SEED.storeA1, [{ productId: SEED.coffeeA, quantity: 6 }]).expect(409);

      expect(res.body.message).toMatch(/Insufficient stock/);
      expect(await salesCount(SEED.storeA1)).toBe(before);
      expect(await stockOf(SEED.storeA1, SEED.coffeeA)).toBe(5);
    });

    it('is all-or-nothing: a valid line is not applied when another line lacks stock', async () => {
      await sell(ownerA, SEED.storeA1, [
        { productId: SEED.teaA, quantity: 1 },
        { productId: SEED.coffeeA, quantity: 99 },
      ]).expect(409);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(10);
    });
  });

  // ------------------------------------------------------------------
  describe('3. Cross-tenant access is rejected', () => {
    it("blocks Merchant A's owner from Merchant B's store (products, inventory, sales)", async () => {
      await api().get(`/api/stores/${SEED.storeB1}/products`).set(auth(ownerA)).expect(403);
      await api().get(`/api/stores/${SEED.storeB1}/inventory`).set(auth(ownerA)).expect(403);
      await api().get(`/api/stores/${SEED.storeB1}/sales`).set(auth(ownerA)).expect(403);
      await sell(ownerA, SEED.storeB1, [{ productId: SEED.teaB, quantity: 1 }]).expect(403);
      expect(await stockOf(SEED.storeB1, SEED.teaB)).toBe(20);
    });

    it("cannot sell another merchant's product from your own store (ID swapping)", async () => {
      const res = await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaB, quantity: 1 }]).expect(400);
      expect(res.body.message).toMatch(/missing or inactive/);
      expect(await stockOf(SEED.storeB1, SEED.teaB)).toBe(20);
    });

    it("cannot read another tenant's sale by ID, even through your own store's URL", async () => {
      const sale = await sell(ownerB, SEED.storeB1, [{ productId: SEED.teaB, quantity: 1 }]).expect(201);
      const id = sale.body.sale.id;

      await api().get(`/api/stores/${SEED.storeA1}/sales/${id}`).set(auth(ownerA)).expect(404);
      await api().get(`/api/stores/${SEED.storeB1}/sales/${id}`).set(auth(ownerA)).expect(403);
      await api().get(`/api/stores/${SEED.storeB1}/sales/${id}`).set(auth(ownerB)).expect(200);
    });

    it("cannot modify another merchant's product or stock via a guessed ID", async () => {
      await api()
        .patch(`/api/stores/${SEED.storeA1}/products/${SEED.teaB}`)
        .set(auth(ownerA))
        .send({ name: 'hacked' })
        .expect(404);
      await api()
        .post(`/api/stores/${SEED.storeA1}/inventory/adjust`)
        .set(auth(ownerA))
        .send({ productId: SEED.teaB, mode: 'SET', quantity: 9999 })
        .expect(404);
    });

    it('enforces store membership and roles inside the same merchant', async () => {
      // cashier works only in A1, not A2
      await api().get(`/api/stores/${SEED.storeA2}/products`).set(auth(cashierA)).expect(403);
      // cashier cannot manage catalogue or stock
      await api()
        .post(`/api/stores/${SEED.storeA1}/products`)
        .set(auth(cashierA))
        .send({ sku: 'X-1', name: 'X', price: '1.00' })
        .expect(403);
      await api()
        .post(`/api/stores/${SEED.storeA1}/inventory/adjust`)
        .set(auth(cashierA))
        .send({ productId: SEED.teaA, mode: 'SET', quantity: 1 })
        .expect(403);
      // unauthenticated
      await api().get(`/api/stores/${SEED.storeA1}/products`).expect(401);
    });

    it('cashiers only see their own sales; owners see the whole store', async () => {
      const ownersSale = await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }]).expect(201);
      const cashiersSale = await sell(cashierA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }]).expect(201);

      const cashierView = await api().get(`/api/stores/${SEED.storeA1}/sales`).set(auth(cashierA)).expect(200);
      const ids = cashierView.body.sales.map((s: { id: string }) => s.id);
      expect(ids).toContain(cashiersSale.body.sale.id);
      expect(ids).not.toContain(ownersSale.body.sale.id);

      await api()
        .get(`/api/stores/${SEED.storeA1}/sales/${ownersSale.body.sale.id}`)
        .set(auth(cashierA))
        .expect(404);
      await api()
        .get(`/api/stores/${SEED.storeA1}/sales/${cashiersSale.body.sale.id}`)
        .set(auth(ownerA))
        .expect(200);
    });
  });

  // ------------------------------------------------------------------
  describe('4. Duplicate (retried) requests', () => {
    it('does not create a second sale or decrement stock twice', async () => {
      const key = newKey();
      const before = await salesCount(SEED.storeA1);

      const first = await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 2 }], { key }).expect(201);
      const second = await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 2 }], { key }).expect(201);

      expect(first.body.replayed).toBe(false);
      expect(second.body.replayed).toBe(true);
      expect(second.body.sale.id).toBe(first.body.sale.id);
      expect(await salesCount(SEED.storeA1)).toBe(before + 1);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(8); // 10 - 2, not 10 - 4
    });

    it('creates only one sale when the same request arrives twice at once', async () => {
      const key = newKey();
      const before = await salesCount(SEED.storeA1);

      const results = await Promise.all([
        sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }], { key }),
        sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }], { key }),
      ]);

      // one wins; the other is either a replay (201) or told it's in flight (409)
      results.forEach((r) => expect([201, 409]).toContain(r.status));
      expect(results.some((r) => r.status === 201)).toBe(true);
      expect(await salesCount(SEED.storeA1)).toBe(before + 1);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(9);
    });

    it('rejects the same key with a different payload (422) and requires the header (400)', async () => {
      const key = newKey();
      await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }], { key }).expect(201);
      await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 5 }], { key }).expect(422);

      await api()
        .post(`/api/stores/${SEED.storeA1}/sales`)
        .set(auth(ownerA))
        .send({ items: [{ productId: SEED.teaA, quantity: 1 }] })
        .expect(400);
    });

    it('allows retrying the same key after a declined payment', async () => {
      const key = newKey();
      await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }], { key, simulatePayment: 'FAILED' }).expect(402);
      // same key + same body is a legitimate retry; this time it is declined again, not blocked
      await sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 1 }], { key, simulatePayment: 'FAILED' }).expect(402);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(10);
    });
  });

  // ------------------------------------------------------------------
  describe('5. Concurrent sales (bonus)', () => {
    it('stock 5, two terminals each sell 3 -> exactly one succeeds, stock stays consistent', async () => {
      await setStock(SEED.storeA1, SEED.teaA, 5);

      const [a, b] = await Promise.all([
        sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 3 }]),
        sell(cashierA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 3 }]),
      ]);

      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(2);
    });

    it('never oversells under heavier contention', async () => {
      await setStock(SEED.storeA1, SEED.teaA, 5);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => sell(ownerA, SEED.storeA1, [{ productId: SEED.teaA, quantity: 2 }])),
      );
      const ok = results.filter((r) => r.status === 201).length;
      expect(ok).toBe(2); // 5 units / 2 per sale
      expect(results.filter((r) => r.status === 409)).toHaveLength(6);
      expect(await stockOf(SEED.storeA1, SEED.teaA)).toBe(1);
    });
  });
});
