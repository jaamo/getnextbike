import { pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

export const resellerStatus = pgEnum('reseller_status', ['active', 'paused', 'archived']);

export const resellers = pgTable('resellers', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  logoUrl: text(),
  description: text(),
  primaryWebsiteUrl: text(),
  status: resellerStatus().notNull().default('active'),
  ...timestamps,
});

export type Reseller = typeof resellers.$inferSelect;
export type NewReseller = typeof resellers.$inferInsert;
