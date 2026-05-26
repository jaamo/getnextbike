import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
  console.log('migrations: ok');
} catch (err) {
  console.error('migrations: failed', err);
  process.exit(1);
} finally {
  await client.end();
}
