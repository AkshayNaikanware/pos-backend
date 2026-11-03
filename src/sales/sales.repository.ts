import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Payment, Sale, SaleItem } from '../database/entities/pos.entities';

export interface SaleScope {
  merchantId: string;
  storeId: string;
  /** Set for CASHIERs so they only see their own sales. */
  userId?: string;
}

@Injectable()
export class SalesRepository {
  constructor(private readonly dataSource: DataSource) {}

  createSale(data: Partial<Sale>, m: EntityManager) {
    return m.save(m.create(Sale, data));
  }

  insertItems(rows: Partial<SaleItem>[], m: EntityManager) {
    return m.insert(SaleItem, rows);
  }

  createPayment(data: Partial<Payment>, m: EntityManager) {
    return m.save(m.create(Payment, data));
  }

  setStatus(id: string, status: Sale['status'], m: EntityManager) {
    return m.update(Sale, id, { status });
  }

  /** Every read filters on merchant AND store (and user for cashiers). */
  async findOne(scope: SaleScope, saleId: string) {
    const sale = await this.dataSource.getRepository(Sale).findOne({
      where: {
        id: saleId,
        merchantId: scope.merchantId,
        storeId: scope.storeId,
        ...(scope.userId ? { userId: scope.userId } : {}),
      },
    });
    if (!sale) return null;
    const [items, payments] = await Promise.all([
      this.dataSource.getRepository(SaleItem).find({ where: { saleId } }),
      this.dataSource.getRepository(Payment).find({ where: { saleId } }),
    ]);
    return { ...sale, items, payments };
  }

  list(scope: SaleScope, limit: number) {
    return this.dataSource.getRepository(Sale).find({
      where: {
        merchantId: scope.merchantId,
        storeId: scope.storeId,
        ...(scope.userId ? { userId: scope.userId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
