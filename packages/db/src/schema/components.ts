import { jsonb, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';

export const componentType = pgEnum('component_type', [
  'groupset',
  'drivetrain',
  'brakes',
  'wheels',
  'tires',
  'fork',
  'shock',
  'cockpit',
  'saddle',
  'seatpost',
  'motor',
  'battery',
  'frame_material',
  'other',
]);

export const components = pgTable('components', {
  id: uuid().primaryKey().defaultRandom(),
  type: componentType().notNull(),
  manufacturer: text(),
  name: text().notNull(),
  tier: text(),
  specJson: jsonb(),
  ...timestamps,
});

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;
