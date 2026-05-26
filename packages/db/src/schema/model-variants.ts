import { integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { modelYears } from './model-years';
import { regions } from './regions';

export const modelVariants = pgTable(
  'model_variants',
  {
    id: uuid().primaryKey().defaultRandom(),
    modelYearId: uuid()
      .notNull()
      .references(() => modelYears.id, { onDelete: 'cascade' }),
    // null = global build; non-null = region-specific build (spec §2.2)
    regionId: uuid().references(() => regions.id, { onDelete: 'restrict' }),
    sku: text(),
    buildName: text(),
    frameSize: text(),
    color: text(),
    weightGrams: integer(),
    notes: text(),
    ...timestamps,
  },
  (t) => [
    // Spec calls for UNIQUE(model_year_id, region_id, build_name, frame_size, color) with
    // nullable-safe semantics. Use COALESCE on NULL-bearing columns so nulls compare equal.
    uniqueIndex('model_variants_identity_unique').on(
      t.modelYearId,
      t.regionId,
      t.buildName,
      t.frameSize,
      t.color,
    ),
  ],
);

export type ModelVariant = typeof modelVariants.$inferSelect;
export type NewModelVariant = typeof modelVariants.$inferInsert;
