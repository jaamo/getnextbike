import { sql } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { resellerLocations } from './reseller-locations';

export const crawlSelectorField = pgEnum('crawl_selector_field', [
  'price',
  'stock',
  'title',
  'original_price',
  'size_breakdown',
]);

export const crawlSelectorStatus = pgEnum('crawl_selector_status', [
  'active',
  'invalid',
  'needs_human',
]);

export const crawlSelectorType = pgEnum('crawl_selector_type', [
  'css',
  'xpath',
  'regex',
  'json_path',
  'meta_tag',
]);

export const crawlSelectorOrigin = pgEnum('crawl_selector_origin', [
  'manual',
  'ai_generated',
  'imported',
]);

// Active selector per (storefront, field). `currentVersionId` is set after the
// first version is inserted — we can't FK it in a single statement because of
// the cycle, so it's a plain UUID column referenced via an app-level invariant.
export const crawlSelectors = pgTable(
  'crawl_selectors',
  {
    id: uuid().primaryKey().defaultRandom(),
    resellerLocationId: uuid()
      .notNull()
      .references(() => resellerLocations.id, { onDelete: 'cascade' }),
    field: crawlSelectorField().notNull(),
    currentVersionId: uuid(),
    status: crawlSelectorStatus().notNull().default('active'),
    failedItemIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('crawl_selectors_location_field_unique').on(t.resellerLocationId, t.field)],
);

export const crawlSelectorVersions = pgTable(
  'crawl_selector_versions',
  {
    id: uuid().primaryKey().defaultRandom(),
    selectorId: uuid()
      .notNull()
      .references(() => crawlSelectors.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    selectorType: crawlSelectorType().notNull(),
    expression: text().notNull(),
    postProcessJson: jsonb(),
    origin: crawlSelectorOrigin().notNull().default('manual'),
    llmModel: text(),
    llmPromptId: text(),
    createdBy: text().notNull().default('system'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    validFrom: timestamp({ withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp({ withTimezone: true }),
  },
  (t) => [unique('crawl_selector_versions_selector_id_version_unique').on(t.selectorId, t.version)],
);

export type CrawlSelector = typeof crawlSelectors.$inferSelect;
export type NewCrawlSelector = typeof crawlSelectors.$inferInsert;
export type CrawlSelectorVersion = typeof crawlSelectorVersions.$inferSelect;
export type NewCrawlSelectorVersion = typeof crawlSelectorVersions.$inferInsert;
