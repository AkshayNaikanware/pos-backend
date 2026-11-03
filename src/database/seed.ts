import dataSource from './data-source';
import { SEED, seedDatabase } from './seed-data';

async function main() {
  await dataSource.initialize();
  await seedDatabase(dataSource);
  await dataSource.destroy();
  console.log('Seeded sample data.');
  console.log(`  Password for all users: ${SEED.password}`);
  console.log(`  Merchant A owner   : ${SEED.ownerA.email}   (stores A1, A2)`);
  console.log(`  Merchant A cashier : ${SEED.cashierA.email} (store A1 only)`);
  console.log(`  Merchant B owner   : ${SEED.ownerB.email}   (store B1)`);
  console.log(`  storeA1=${SEED.storeA1}`);
  console.log(`  storeB1=${SEED.storeB1}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
