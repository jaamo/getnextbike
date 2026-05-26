/**
 * Bootstrap the first admin user from env vars. Run after migrations on a
 * fresh deploy so an operator can log in to the admin UI:
 *
 *   ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD=… pnpm --filter @getnextbike/db seed:admin
 *
 * Idempotent: if the email already exists, the role and password hash are
 * updated to match the env vars.
 */
import './_env';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from './schema/users';

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  process.exit(1);
}
if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters');
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client, { casing: 'snake_case' });

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    await db.update(users).set({ passwordHash, role: 'admin' }).where(eq(users.id, existing.id));
    console.log(`updated existing user ${email} (role=admin, password rotated)`);
  } else {
    const [row] = await db
      .insert(users)
      .values({ email, passwordHash, role: 'admin', name: 'Admin' })
      .returning();
    console.log(`created admin user ${email} (id=${row?.id})`);
  }
} catch (err) {
  console.error('seed-admin failed:', err);
  process.exit(1);
} finally {
  await client.end();
}
