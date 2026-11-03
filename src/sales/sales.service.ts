import {
  BadRequestException, ConflictException, HttpException, HttpStatus,
  Injectable, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

import { CacheService } from '../cache/cache.service';
import { InventoryRepository } from '../inventory/inventory.repository';
import { PaymentsService } from '../payments/payments.service';
import { ProductsRepository } from '../products/products.repository';
import { CreateSaleDto } from './dto/create-sale.dto';
import { IdempotencyRepository } from './idempotency.repository';
import { fromMinor, toMinor } from './money';
import { SaleScope, SalesRepository } from './sales.repository';

export interface SaleContext {
  userId: string;
  merchantId: string;
  storeId: string;
}

/** A PROCESSING key older than this is assumed to belong to a crashed request. */
const STALE_PROCESSING_MS = 2 * 60 * 1000;

@Injectable()
export class SalesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly sales: SalesRepository,
    private readonly products: ProductsRepository,
    private readonly inventory: InventoryRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly payments: PaymentsService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  async create(ctx: SaleContext, idempotencyKey: string, dto: CreateSaleDto) {
    // Merge duplicate lines ([A x1, A x2] -> [A x3]) and sort for a stable order.
    const merged = new Map<string, number>();
    for (const i of dto.items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
    const items = [...merged.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId));

    const requestHash = createHash('sha256')
      .update(JSON.stringify({ items, simulate: dto.simulatePayment ?? null }))
      .digest('hex');

    // 1) Claim the idempotency key (or replay / reject).
    const claim = await this.claimKey(ctx, idempotencyKey, requestHash);
    if (claim.replay) {
      const sale = await this.sales.findOne(ctx, claim.saleId);
      return { success: true, replayed: true, sale };
    }

    // 2) Do all the work in ONE transaction.
    try {
      const outcome = await this.dataSource.transaction((m) =>
        this.processSale(m, ctx, claim.keyId, items, dto.simulatePayment),
      );

      const sale = await this.sales.findOne(ctx, outcome.saleId);
      if (outcome.paid) {
        await this.cache.bump(`s:${ctx.storeId}`); // stock changed -> invalidate product list
        return { success: true, replayed: false, sale };
      }
      // Payment declined: the FAILED sale + payment are already committed.
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'Payment failed',
          saleId: outcome.saleId,
          saleNumber: sale?.saleNumber,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    } catch (error) {
      // Nothing was committed (or key already FAILED) -> let the client retry.
      await this.idempotency.markFailed(claim.keyId);
      throw error;
    }
  }

  async findOne(scope: SaleScope, saleId: string) {
    const sale = await this.sales.findOne(scope, saleId);
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  list(scope: SaleScope, limit = 50) {
    return this.sales.list(scope, Math.min(Math.max(limit || 50, 1), 200));
  }

  // ------------------------------------------------------------------
  // The transactional core
  // ------------------------------------------------------------------
  private async processSale(
    m: EntityManager,
    ctx: SaleContext,
    keyId: string,
    items: { productId: string; quantity: number }[],
    simulate?: 'SUCCESS' | 'FAILED',
  ): Promise<{ saleId: string; paid: boolean }> {
    const productIds = items.map((i) => i.productId);

    // a) Products must belong to THIS merchant and be active (tenant isolation).
    const products = await this.products.findActiveByIds(productIds, ctx.merchantId, m);
    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are missing or inactive');
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    // b) Lock the stock rows (SELECT ... FOR UPDATE) in a stable order.
    //    A concurrent sale of the same product waits here, then sees the
    //    already-decremented quantity -> no overselling, no deadlocks.
    const rows = await this.inventory.lockMany(ctx.storeId, productIds, m);
    const stock = new Map(rows.map((r) => [r.productId, r]));

    // c) Server-side prices + availability check + totals (integer paise).
    let subtotalMinor = 0;
    const lines = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const row = stock.get(item.productId);
      if (!row || row.quantity < item.quantity) {
        throw new ConflictException(
          `Insufficient stock for "${product.name}" (available: ${row?.quantity ?? 0})`,
        );
      }
      const unitMinor = toMinor(product.price);
      const lineMinor = unitMinor * item.quantity;
      subtotalMinor += lineMinor;
      return { item, row, unitMinor, lineMinor };
    });

    const taxRate = Number(this.config.get<string>('TAX_RATE_PERCENT') ?? 0);
    const taxMinor = Math.round((subtotalMinor * taxRate) / 100);
    const totalMinor = subtotalMinor + taxMinor;

    // d) Persist the sale (PENDING) and its items.
    const sale = await this.sales.createSale(
      {
        merchantId: ctx.merchantId,
        storeId: ctx.storeId,
        userId: ctx.userId,
        saleNumber: this.newSaleNumber(),
        status: 'PENDING',
        subtotal: fromMinor(subtotalMinor),
        tax: fromMinor(taxMinor),
        total: fromMinor(totalMinor),
      },
      m,
    );
    await this.sales.insertItems(
      lines.map((l) => ({
        saleId: sale.id,
        merchantId: ctx.merchantId,
        storeId: ctx.storeId,
        productId: l.item.productId,
        quantity: l.item.quantity,
        unitPrice: fromMinor(l.unitMinor),
        lineTotal: fromMinor(l.lineMinor),
      })),
      m,
    );

    // e) Payment goes through the provider abstraction.
    const charge = await this.payments.charge({
      saleId: sale.id,
      amount: sale.total,
      currency: this.config.get<string>('CURRENCY') ?? 'INR',
      simulate,
    });
    await this.sales.createPayment(
      {
        saleId: sale.id,
        merchantId: ctx.merchantId,
        storeId: ctx.storeId,
        provider: charge.provider,
        providerReference: charge.providerReference,
        status: charge.status,
        amount: sale.total,
        response: charge.response,
      },
      m,
    );

    // f) Declined: keep an auditable FAILED sale, do NOT touch stock.
    if (charge.status !== 'SUCCESS') {
      await this.sales.setStatus(sale.id, 'FAILED', m);
      await this.idempotency.setResult(keyId, 'FAILED', sale.id, m);
      return { saleId: sale.id, paid: false };
    }

    // g) Paid: decrement stock, complete the sale, settle the idempotency key.
    for (const l of lines) {
      await this.inventory.setQuantity(l.row.id, l.row.quantity - l.item.quantity, m);
    }
    await this.sales.setStatus(sale.id, 'COMPLETED', m);
    await this.idempotency.setResult(keyId, 'COMPLETED', sale.id, m);
    return { saleId: sale.id, paid: true };
  }

  // ------------------------------------------------------------------
  // Idempotency
  // ------------------------------------------------------------------
  private async claimKey(ctx: SaleContext, key: string, requestHash: string) {
    const created = await this.idempotency.tryCreate({
      merchantId: ctx.merchantId,
      storeId: ctx.storeId,
      idempotencyKey: key,
      requestHash,
    });
    if (created) return { replay: false as const, keyId: created.id };

    const existing = await this.idempotency.find(ctx.storeId, key);

    if (existing.requestHash !== requestHash) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used with a different request',
      );
    }
    if (existing.status === 'COMPLETED' && existing.saleId) {
      return { replay: true as const, saleId: existing.saleId };
    }
    if (existing.status === 'FAILED' && (await this.idempotency.takeOverFailed(existing.id))) {
      return { replay: false as const, keyId: existing.id };
    }
    if (
      existing.status === 'PROCESSING' &&
      (await this.idempotency.takeOverStale(existing.id, STALE_PROCESSING_MS))
    ) {
      return { replay: false as const, keyId: existing.id };
    }
    throw new ConflictException('This request is still being processed');
  }

  private newSaleNumber(): string {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `S-${d}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
