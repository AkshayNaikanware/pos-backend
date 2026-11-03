import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoreAccessGuard } from '../auth/store-access.guard';
import type { AuthenticatedRequest, StoreRequest } from '../auth/auth.types';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // GET /api/stores  -> stores the logged-in user can access
  @Get()
  @UseGuards(JwtAuthGuard)
  async myStores(@Req() request: AuthenticatedRequest) {
    const stores = await this.storesService.findForUser(request.user.id);
    return { success: true, stores };
  }

  @Get(':storeId/access-check')
  @UseGuards(JwtAuthGuard, StoreAccessGuard)
  checkAccess(@Param('storeId') _storeId: string, @Req() request: StoreRequest) {
    return {
      success: true,
      message: 'You have access to this store',
      access: request.storeAccess,
    };
  }
}
