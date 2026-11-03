import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoreAccessGuard } from '../auth/store-access.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { StoreRequest } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';

@Controller('stores/:storeId/inventory')
@UseGuards(JwtAuthGuard, StoreAccessGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async list(@Req() req: StoreRequest) {
    const { merchantId, storeId } = req.storeAccess;
    return { success: true, inventory: await this.inventoryService.list(merchantId, storeId) };
  }

  @Post('adjust')
  @Roles('OWNER', 'MANAGER')
  async adjust(@Req() req: StoreRequest, @Body() dto: AdjustInventoryDto) {
    const { merchantId, storeId } = req.storeAccess;
    return { success: true, inventory: await this.inventoryService.adjust(merchantId, storeId, dto) };
  }
}
