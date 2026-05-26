import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { brands } from './brands';

export const modelCategory = pgEnum('model_category', [
  'road',
  'gravel',
  'mtb_xc',
  'mtb_trail',
  'mtb_enduro',
  'mtb_dh',
  'hybrid',
  'commuter',
  'city',
  'cargo',
  'kids',
  'bmx',
  'ebike_road',
  'ebike_mtb',
  'ebike_city',
  'ebike_cargo',
  'ebike_commuter',
]);

export const models = pgTable(
  'models',
  {
    id: uuid().primaryKey().defaultRandom(),
    brandId: uuid()
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    slug: text().notNull(),
    name: text().notNull(),
    category: modelCategory().notNull(),
    disciplineTags: text().array().notNull().default(sql`'{}'::text[]`),
    description: text(),
    ...timestamps,
  },
  (t) => [unique('models_brand_id_slug_unique').on(t.brandId, t.slug)],
);

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
