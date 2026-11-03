import dataSource from './data-source';

/** DEV ONLY: drops every table in the configured database. */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset a production database.');
  }
  await dataSource.initialize();
  await dataSource.dropDatabase(); // drops all tables incl. the migrations table
  await dataSource.destroy();
  console.log(`All tables dropped from "${process.env.DB_NAME}".`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
