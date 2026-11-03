import dataSource from './data-source';

/** Runs pending migrations without going through the TypeORM CLI wrapper
 *  (more reliable on Windows). Usage: npm run migration:run */
async function main() {
  await dataSource.initialize();
  const ran = await dataSource.runMigrations({ transaction: 'all' });
  console.log(
    ran.length ? `Applied: ${ran.map((m) => m.name).join(', ')}` : 'Database is already up to date.',
  );
  await dataSource.destroy();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
