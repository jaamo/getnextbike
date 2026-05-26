import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { components } from './components';
import { modelVariants } from './model-variants';

export const modelVariantComponents = pgTable(
  'model_variant_components',
  {
    variantId: uuid()
      .notNull()
      .references(() => modelVariants.id, { onDelete: 'cascade' }),
    componentId: uuid()
      .notNull()
      .references(() => components.id, { onDelete: 'restrict' }),
    role: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.componentId, t.role] })],
);

export type ModelVariantComponent = typeof modelVariantComponents.$inferSelect;
export type NewModelVariantComponent = typeof modelVariantComponents.$inferInsert;
