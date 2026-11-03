import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Inventory, Product } from '../database/entities/pos.entities';

@Injectable()
export class ProductsRepository {
  constructor(private readonly dataSource: DataSource) {}

  private repo(m?: EntityManager) {
    return (m ?? this.dataSource.manager).getRepository(Product);
  }

  create(data: Partial<Product>, m?: EntityManager) {
    const r = this.repo(m);
    return r.save(r.create(data));
  }

  save(product: Product, m?: EntityManager) {
    return this.repo(m).save(product);
  }

  /** Always scoped by merchant: an ID from another tenant simply isn't found. */
  findOne(id: string, merchantId: string, m?: EntityManager) {
    return this.repo(m).findOne({ where: { id, merchantId } });
  }

  findActiveByIds(ids: string[], merchantId: string, m?: EntityManager) {
    return this.repo(m).find({ where: { id: In(ids), merchantId, isActive: true } });
  }

  listWithStock(merchantId: string, storeId: string, search?: string) {
    const qb = this.repo()
      .createQueryBuilder('p')
      .leftJoin(Inventory, 'inv', 'inv.productId = p.id AND inv.storeId = :storeId', { storeId })
      .where('p.merchantId = :merchantId', { merchantId })
      .select('p.id', 'id')
      .addSelect('p.sku', 'sku')
      .addSelect('p.name', 'name')
      .addSelect('p.description', 'description')
      .addSelect('p.price', 'price')
      .addSelect('p.isActive', 'isActive')
      .addSelect('COALESCE(inv.quantity, 0)', 'quantity')
      .orderBy('p.name', 'ASC');
    if (search) {
      qb.andWhere('(p.name ILIKE :q OR p.sku ILIKE :q)', { q: `%${search}%` });
    }
    return qb.getRawMany();
  }
}
