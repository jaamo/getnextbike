import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { crawlSelectorVersions } from './crawl-selectors';
import { inventoryItems } from './inventory-items';

export const crawlRunStatus = pgEnum('crawl_run_status', [
  'success',
  'partial',
  'failed',
  'blocked',
  'timeout',
]);

export const crawlRunTrigger = pgEnum('crawl_run_trigger', [
  'schedule',
  'manual',
  'regen_validation',
  'webhook',
]);

// `catalog_source_id` (Phase 4) is intentionally omitted in Phase 2 — when
// catalog crawling lands, a follow-up migration will add the nullable column
// and replace the CHECK below with the spec's "exactly one FK set" rule.
export const crawlRuns = pgTable(
  'crawl_runs',
  {
    id: uuid().primaryKey().defaultRandom(),
    inventoryItemId: uuid().references(() => inventoryItems.id, { onDelete: 'set null' }),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    status: crawlRunStatus().notNull(),
    httpStatus: integer(),
    fetchDurationMs: integer(),
    htmlSnapshotUrl: text(),
    trigger: crawlRunTrigger().notNull(),
    errorClass: text(),
    errorMessage: text(),
  },
  (t) => [
    // Until Phase 4 adds catalog_source_id, every crawl run must target an
    // inventory item. The check will be loosened in the catalog migration.
    check('crawl_runs_inventory_item_id_required', sql`${t.inventoryItemId} IS NOT NULL`),
  ],
);

export const crawlFieldResultOutcome = pgEnum('crawl_field_result_outcome', [
  'success',
  'selector_missed',
  'parse_failed',
  'value_implausible',
  'skipped',
]);

export const crawlFieldResults = pgTable('crawl_field_results', {
  id: uuid().primaryKey().defaultRandom(),
  crawlRunId: uuid()
    .notNull()
    .references(() => crawlRuns.id, { onDelete: 'cascade' }),
  // matches crawl_selectors.field — duplicated to avoid a join on read
  field: text().notNull(),
  selectorVersionId: uuid().references(() => crawlSelectorVersions.id, { onDelete: 'set null' }),
  extractedRaw: text(),
  extractedNormalized: text(),
  outcome: crawlFieldResultOutcome().notNull(),
  confidence: numeric({ precision: 5, scale: 4 }),
});

export type CrawlRun = typeof crawlRuns.$inferSelect;
export type NewCrawlRun = typeof crawlRuns.$inferInsert;
export type CrawlFieldResult = typeof crawlFieldResults.$inferSelect;
export type NewCrawlFieldResult = typeof crawlFieldResults.$inferInsert;
