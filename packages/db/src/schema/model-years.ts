import { integer, numeric, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { models } from './models';

export const modelYears = pgTable(
  'model_years',
  {
    id: uuid().primaryKey().defaultRandom(),
    modelId: uuid()
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    year: integer().notNull(),
    msrpAmount: numeric({ precision: 10, scale: 2 }),
    msrpCurrency: text(),
    heroImageUrl: text(),
    specSheetUrl: text(),
    ...timestamps,
  },
  (t) => [unique('model_years_model_id_year_unique').on(t.modelId, t.year)],
);

export type ModelYear = typeof modelYears.$inferSelect;
export type NewModelYear = typeof modelYears.$inferInsert;
