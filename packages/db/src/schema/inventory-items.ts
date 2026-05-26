import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { modelVariants } from './model-variants';
import { resellerLocations } from './reseller-locations';

export const inventoryItemStatus = pgEnum('inventory_item_status', [
  'live',
  'delisted',
  'needs_review',
  'archived',
]);

// One row per product page on a specific online storefront. Crawl-time
// enforcement that reseller_location_id points to a kind = 'online' row lives
// in a trigger (see migrations/0003_phase2_constraints.sql).
export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    resellerLocationId: uuid()
      .notNull()
      .references(() => resellerLocations.id, { onDelete: 'cascade' }),
    variantId: uuid().references(() => modelVariants.id, { onDelete: 'set null' }),
    productUrl: text().notNull(),
    resellerSku: text(),
    titleAtSource: text(),
    status: inventoryItemStatus().notNull().default('live'),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastCrawledAt: timestamp({ withTimezone: true }),
    lastSuccessAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('inventory_items_reseller_location_id_product_url_unique').on(
      t.resellerLocationId,
      t.productUrl,
    ),
  ],
);

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
