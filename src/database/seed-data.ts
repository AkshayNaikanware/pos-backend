import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import {
  Inventory, Merchant, Product, Store, User, UserStore,
} from './entities/pos.entities';

/** Fixed IDs so tests, Postman and docs can all refer to the same records. */
export const SEED = {
  password: 'Password@123',
  merchantA: '00000000-0000-4000-8000-0000000000a1',
  merchantB: '00000000-0000-4000-8000-0000000000b1',
  storeA1: '00000000-0000-4000-8000-00000000a501',
  storeA2: '00000000-0000-4000-8000-00000000a502',
  storeB1: '00000000-0000-4000-8000-00000000b501',
  ownerA: { id: '00000000-0000-4000-8000-00000000a0a1', email: 'owner@merchant-a.test' },
  cashierA: { id: '00000000-0000-4000-8000-00000000a0c1', email: 'cashier@merchant-a.test' },
  ownerB: { id: '00000000-0000-4000-8000-00000000b0a1', email: 'owner@merchant-b.test' },
  teaA: '00000000-0000-4000-8000-0000000a7e01',
  coffeeA: '00000000-0000-4000-8000-0000000a7e02',
  snackA: '00000000-0000-4000-8000-0000000a7e03',
  teaB: '00000000-0000-4000-8000-0000000b7e01',
} as const;

async function upsert<T extends { id: string }>(
  m: EntityManager,
  target: new () => T,
  data: Partial<T> & { id: string },
) {
  const existing = await m.findOne(target as never, { where: { id: data.id } } as never);
  if (existing) return existing as T;
  return (await m.save(m.create(target as never, data as never))) as T;
}

/**
 * Idempotent seed:
 *   Merchant A -> Store A1, Store A2   (owner, cashier on A1)
 *   Merchant B -> Store B1             (owner)
 */
export async function seedDatabase(dataSource: DataSource) {
  const hash = await bcrypt.hash(SEED.password, 10);

  await dataSource.transaction(async (m) => {
    await upsert(m, Merchant, { id: SEED.merchantA, name: 'Merchant A', email: 'a@merchant.test' });
    await upsert(m, Merchant, { id: SEED.merchantB, name: 'Merchant B', email: 'b@merchant.test' });

    await upsert(m, Store, { id: SEED.storeA1, merchantId: SEED.merchantA, name: 'A - Store 1', address: 'Pune' });
    await upsert(m, Store, { id: SEED.storeA2, merchantId: SEED.merchantA, name: 'A - Store 2', address: 'Mumbai' });
    await upsert(m, Store, { id: SEED.storeB1, merchantId: SEED.merchantB, name: 'B - Store 1', address: 'Delhi' });

    await upsert(m, User, { id: SEED.ownerA.id, name: 'Owner A', email: SEED.ownerA.email, passwordHash: hash });
    await upsert(m, User, { id: SEED.cashierA.id, name: 'Cashier A', email: SEED.cashierA.email, passwordHash: hash });
    await upsert(m, User, { id: SEED.ownerB.id, name: 'Owner B', email: SEED.ownerB.email, passwordHash: hash });

    const links: Array<[string, string, string, 'OWNER' | 'MANAGER' | 'CASHIER', string]> = [
      ['00000000-0000-4000-8000-000000000c01', SEED.ownerA.id, SEED.merchantA, 'OWNER', SEED.storeA1],
      ['00000000-0000-4000-8000-000000000c02', SEED.ownerA.id, SEED.merchantA, 'OWNER', SEED.storeA2],
      ['00000000-0000-4000-8000-000000000c03', SEED.cashierA.id, SEED.merchantA, 'CASHIER', SEED.storeA1],
      ['00000000-0000-4000-8000-000000000c04', SEED.ownerB.id, SEED.merchantB, 'OWNER', SEED.storeB1],
    ];
    for (const [id, userId, merchantId, role, storeId] of links) {
      await upsert(m, UserStore, { id, userId, merchantId, role, storeId });
    }

    await upsert(m, Product, { id: SEED.teaA, merchantId: SEED.merchantA, sku: 'TEA-001', name: 'Masala Tea', price: '20.00' });
    await upsert(m, Product, { id: SEED.coffeeA, merchantId: SEED.merchantA, sku: 'COF-001', name: 'Filter Coffee', price: '35.50' });
    await upsert(m, Product, { id: SEED.snackA, merchantId: SEED.merchantA, sku: 'SNK-001', name: 'Samosa', price: '12.00' });
    // Same SKU as A's tea but a different tenant - SKUs are unique per merchant.
    await upsert(m, Product, { id: SEED.teaB, merchantId: SEED.merchantB, sku: 'TEA-001', name: 'Green Tea', price: '25.00' });

    const stock: Array<[string, string, string, string, number]> = [
      ['00000000-0000-4000-8000-0000000d1001', SEED.merchantA, SEED.storeA1, SEED.teaA, 100],
      ['00000000-0000-4000-8000-0000000d1002', SEED.merchantA, SEED.storeA1, SEED.coffeeA, 5],
      ['00000000-0000-4000-8000-0000000d1003', SEED.merchantA, SEED.storeA1, SEED.snackA, 40],
      ['00000000-0000-4000-8000-0000000d1004', SEED.merchantA, SEED.storeA2, SEED.teaA, 50],
      ['00000000-0000-4000-8000-0000000d1005', SEED.merchantB, SEED.storeB1, SEED.teaB, 20],
    ];
    for (const [id, merchantId, storeId, productId, quantity] of stock) {
      await upsert(m, Inventory, { id, merchantId, storeId, productId, quantity });
    }
  });
}
