import { boolean, numeric, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { modelYears } from './model-years';
import { regions } from './regions';

export const modelYearRegionAvailability = pgTable(
  'model_year_region_availability',
  {
    modelYearId: uuid()
      .notNull()
      .references(() => modelYears.id, { onDelete: 'cascade' }),
    regionId: uuid()
      .notNull()
      .references(() => regions.id, { onDelete: 'cascade' }),
    msrpAmount: numeric({ precision: 10, scale: 2 }),
    msrpCurrency: text(),
    available: boolean().notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.modelYearId, t.regionId] })],
);

export type ModelYearRegionAvailability = typeof modelYearRegionAvailability.$inferSelect;
export type NewModelYearRegionAvailability = typeof modelYearRegionAvailability.$inferInsert;
