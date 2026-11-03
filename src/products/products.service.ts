import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsRepository } from './products.repository';

const UNIQUE_VIOLATION = '23505';
const LIST_TTL_SECONDS = 60;

@Injectable()
export class ProductsService {
  constructor(
    private readonly products: ProductsRepository,
    private readonly cache: CacheService,
  ) {}

  async create(merchantId: string, dto: CreateProductDto) {
    try {
      const product = await this.products.create({
        ...dto,
        merchantId,
        description: dto.description ?? null,
      });
      await this.cache.bump(`m:${merchantId}`);
      return product;
    } catch (e) {
      this.rethrowUnique(e, `SKU "${dto.sku}" already exists`);
      throw e;
    }
  }

  /**
   * Read-heavy endpoint (every POS screen loads it) -> Redis cache.
   * Key embeds a merchant version (product changes) and a store version
   * (stock changes), so any write invalidates by bumping a counter.
   */
  async findAll(merchantId: string, storeId: string, search?: string) {
    const [mv, sv] = await Promise.all([
      this.cache.version(`m:${merchantId}`),
      this.cache.version(`s:${storeId}`),
    ]);
    const key = `plist:${storeId}:${mv}:${sv}:${(search ?? '').toLowerCase()}`;
    return this.cache.getOrSet(key, LIST_TTL_SECONDS, () =>
      this.products.listWithStock(merchantId, storeId, search),
    );
  }

  async update(merchantId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.products.findOne(productId, merchantId);
    if (!product) throw new NotFoundException('Product not found');
    Object.assign(product, dto);
    try {
      const saved = await this.products.save(product);
      await this.cache.bump(`m:${merchantId}`);
      return saved;
    } catch (e) {
      this.rethrowUnique(e, 'SKU already exists');
      throw e;
    }
  }

  private rethrowUnique(e: unknown, message: string) {
    if ((e as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException(message);
  }
}
