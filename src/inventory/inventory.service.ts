import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { ProductsRepository } from '../products/products.repository';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryRepository } from './inventory.repository';

@Injectable()
export class InventoryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryRepository,
    private readonly products: ProductsRepository,
    private readonly cache: CacheService,
  ) {}

  list(merchantId: string, storeId: string) {
    return this.inventory.list(merchantId, storeId);
  }

  async adjust(merchantId: string, storeId: string, dto: AdjustInventoryDto) {
    const result = await this.dataSource.transaction(async (m) => {
      const product = await this.products.findOne(dto.productId, merchantId, m);
      if (!product) throw new NotFoundException('Product not found');

      await this.inventory.ensureRow(merchantId, storeId, dto.productId, m);
      const [row] = await this.inventory.lockMany(storeId, [dto.productId], m);

      const next = dto.mode === 'SET' ? dto.quantity : row.quantity + dto.quantity;
      if (next < 0) throw new BadRequestException('Stock cannot go below zero');

      await this.inventory.setQuantity(row.id, next, m);
      return { ...row, quantity: next };
    });
    await this.cache.bump(`s:${storeId}`);
    return result;
  }
}
