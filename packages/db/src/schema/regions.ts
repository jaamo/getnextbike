import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const regions = pgTable('regions', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  name: text().notNull(),
  defaultCurrency: text().notNull(),
  countries: text().array().notNull().default(sql`'{}'::text[]`),
});

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;
