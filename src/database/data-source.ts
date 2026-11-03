import 'dotenv/config';
import { DataSource } from 'typeorm';

// Fail early with a readable message instead of a cryptic driver error.
const missing = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'].filter(
  (k) => process.env[k] === undefined,
);
if (missing.length) {
  throw new Error(
    `Missing environment variable(s): ${missing.join(', ')}. ` +
      'Copy .env.example to .env (project root) and fill in your PostgreSQL details.',
  );
}

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
} from './entities/pos.entities';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

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

  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
});
