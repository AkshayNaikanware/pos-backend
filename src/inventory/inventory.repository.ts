import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Inventory, Product } from '../database/entities/pos.entities';

@Injectable()
export class InventoryRepository {
  constructor(private readonly dataSource: DataSource) {}

  list(merchantId: string, storeId: string) {
    return this.dataSource
      .getRepository(Inventory)
      .createQueryBuilder('inv')
      .innerJoin(Product, 'p', 'p.id = inv.productId')
      .where('inv.storeId = :storeId AND inv.merchantId = :merchantId', { storeId, merchantId })
      .select('inv.productId', 'productId')
      .addSelect('p.sku', 'sku')
      .addSelect('p.name', 'name')
      .addSelect('inv.quantity', 'quantity')
      .orderBy('p.name', 'ASC')
      .getRawMany();
  }

  /** Creates the (store, product) row if missing - safe under concurrency. */
  async ensureRow(merchantId: string, storeId: string, productId: string, m: EntityManager) {
    await m
      .createQueryBuilder()
      .insert()
      .into(Inventory)
      .values({ merchantId, storeId, productId, quantity: 0 })
      .orIgnore()
      .execute();
  }

  /** SELECT ... FOR UPDATE on the given stock rows, in a stable order. */
  lockMany(storeId: string, productIds: string[], m: EntityManager) {
    return m.find(Inventory, {
      where: { storeId, productId: In(productIds) },
      order: { productId: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  setQuantity(id: string, quantity: number, m: EntityManager) {
    return m.update(Inventory, id, { quantity });
  }
}
