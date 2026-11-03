import dataSource from './data-source';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset a production database.');
  }
  await dataSource.initialize();
  await dataSource.dropDatabase();
  await dataSource.destroy();
  console.log(`All tables dropped from "${process.env.DB_NAME}".`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
