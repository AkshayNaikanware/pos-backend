import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  Merchant,
  Store,
  User,
  UserStore,
  Product,
  Inventory,
  Sale,
  SaleItem,
  Payment,
  IdempotencyKey,
} from './database/entities/pos.entities';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MerchantsModule } from './merchants/merchants.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { CacheModule } from './cache/cache.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT') ?? 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),

        entities: [
          Merchant,
          Store,
          User,
          UserStore,
          Product,
          Inventory,
          Sale,
          SaleItem,
          Payment,
          IdempotencyKey,
        ],

        synchronize: false,
        logging: configService.get<string>('DB_LOGGING') === 'true',
      }),
    }),

    CacheModule,

    AuthModule,

    UsersModule,

    MerchantsModule,

    StoresModule,

    ProductsModule,

    InventoryModule,

    SalesModule,

    PaymentsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
