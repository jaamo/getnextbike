import { defineConfig } from 'drizzle-kit';

// DATABASE_URL is only required for commands that touch a live DB (migrate,
// push, pull, studio). `generate` works purely from schema files, so we
// tolerate a missing URL there.
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://placeholder@localhost/placeholder';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
