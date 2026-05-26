import { bigserial, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { crawlRuns } from './crawl-runs';
import { inventoryItems } from './inventory-items';

export const priceObservations = pgTable(
  'price_observations',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    inventoryItemId: uuid()
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    amount: numeric({ precision: 10, scale: 2 }).notNull(),
    currency: text().notNull(),
    originalAmount: numeric({ precision: 10, scale: 2 }),
    crawlRunId: uuid().references(() => crawlRuns.id, { onDelete: 'set null' }),
    capturedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('price_observations_item_captured_idx').on(t.inventoryItemId, t.capturedAt.desc())],
);

export type PriceObservation = typeof priceObservations.$inferSelect;
export type NewPriceObservation = typeof priceObservations.$inferInsert;
