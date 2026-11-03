import { Client } from 'pg';
import dataSource from '../../src/database/data-source';
import { seedDatabase } from '../../src/database/seed-data';

/** Creates the test DB if needed, then rebuilds it from the real migrations + seed. */
export async function resetTestDatabase() {
  const name = process.env.DB_NAME!;
  const admin = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  await dataSource.initialize();
  await dataSource.dropDatabase();
  await dataSource.runMigrations();
  await seedDatabase(dataSource);
  await dataSource.destroy();
}
