import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoreAccessGuard } from '../auth/store-access.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { StoreRequest } from '../auth/auth.types';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Controller('stores/:storeId/products')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@Req() req: StoreRequest, @Query('search') search?: string) {
    const { merchantId, storeId } = req.storeAccess;
    return { success: true, products: await this.productsService.findAll(merchantId, storeId, search?.slice(0, 50)) };
  }

  @Post()
  @Roles('OWNER', 'MANAGER')
  async create(@Req() req: StoreRequest, @Body() dto: CreateProductDto) {
    return { success: true, product: await this.productsService.create(req.storeAccess.merchantId, dto) };
  }

  @Patch(':productId')
  @Roles('OWNER', 'MANAGER')
  async update(
    @Req() req: StoreRequest,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return { success: true, product: await this.productsService.update(req.storeAccess.merchantId, productId, dto) };
  }
}
