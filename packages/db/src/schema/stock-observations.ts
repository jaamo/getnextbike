import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { crawlRuns } from './crawl-runs';
import { inventoryItems } from './inventory-items';
import { resellerLocations } from './reseller-locations';

export const stockStatus = pgEnum('stock_status', [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'preorder',
  'backorder',
  'discontinued',
  'unknown',
]);

// One row per location reported on the product page. Always includes a row
// for the inventory item's own online location, plus one for each physical
// store the page names. A trigger (migrations/0003_phase2_constraints.sql)
// enforces that reseller_location belongs to the same reseller as the
// inventory item's location.
export const stockObservations = pgTable(
  'stock_observations',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    inventoryItemId: uuid()
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    resellerLocationId: uuid()
      .notNull()
      .references(() => resellerLocations.id, { onDelete: 'cascade' }),
    status: stockStatus().notNull(),
    quantity: integer(),
    sizeBreakdownJson: jsonb(),
    crawlRunId: uuid().references(() => crawlRuns.id, { onDelete: 'set null' }),
    capturedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('stock_observations_item_loc_captured_idx').on(
      t.inventoryItemId,
      t.resellerLocationId,
      t.capturedAt.desc(),
    ),
  ],
);

export type StockObservation = typeof stockObservations.$inferSelect;
export type NewStockObservation = typeof stockObservations.$inferInsert;
