import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { ProductsModule } from '../products/products.module';
import { IdempotencyRepository } from './idempotency.repository';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [AuthModule, PaymentsModule, ProductsModule, InventoryModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository, IdempotencyRepository],
})
export class SalesModule {}
