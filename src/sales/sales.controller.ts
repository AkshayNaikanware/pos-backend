import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, Param,
  ParseUUIDPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoreAccessGuard } from '../auth/store-access.guard';
import type { StoreRequest } from '../auth/auth.types';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Controller('stores/:storeId/sales')
@UseGuards(JwtAuthGuard, StoreAccessGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(201)
  create(
    @Req() req: StoreRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreateSaleDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 150) {
      throw new BadRequestException('Idempotency-Key header is required (max 150 chars)');
    }
    const { merchantId, storeId } = req.storeAccess;
    return this.salesService.create({ userId: req.user.id, merchantId, storeId }, idempotencyKey, dto);
  }

  @Get()
  async list(@Req() req: StoreRequest, @Query('limit') limit?: string) {
    const sales = await this.salesService.list(this.scope(req), limit ? Number(limit) : 50);
    return { success: true, sales };
  }

  @Get(':saleId')
  async one(@Req() req: StoreRequest, @Param('saleId', ParseUUIDPipe) saleId: string) {
    return { success: true, sale: await this.salesService.findOne(this.scope(req), saleId) };
  }

  /** Cashiers only see their own sales; owners/managers see the whole store. */
  private scope(req: StoreRequest) {
    const { merchantId, storeId, role } = req.storeAccess;
    return { merchantId, storeId, userId: role === 'CASHIER' ? req.user.id : undefined };
  }
}
