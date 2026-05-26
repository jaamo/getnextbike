import { createDb, type Database } from '@getnextbike/db';
import { env } from './env';

// Single shared client across the Next.js process. Reuse across hot reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __getnextbike_db: Database | undefined;
}

export const db: Database = globalThis.__getnextbike_db ?? createDb(env.DATABASE_URL);

if (process.env.NODE_ENV !== 'production') {
  globalThis.__getnextbike_db = db;
}
