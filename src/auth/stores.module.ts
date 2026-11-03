import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserStore } from '../database/entities/pos.entities';
import { StoreAccessGuard } from '../auth/store-access.guard';
import { StoresController } from 'src/stores/stores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserStore])],
  controllers: [StoresController],
  providers: [StoreAccessGuard],
})
export class StoresModule {}
