import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

export const brands = pgTable('brands', {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  countryCode: text(),
  websiteUrl: text(),
  description: text(),
  ...timestamps,
});

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
