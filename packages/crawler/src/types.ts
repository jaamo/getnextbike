import type { schema } from '@getnextbike/db';

export type CrawlSelectorField = (typeof schema.crawlSelectorField.enumValues)[number];
export type CrawlSelectorType = (typeof schema.crawlSelectorType.enumValues)[number];
export type CrawlRunStatus = (typeof schema.crawlRunStatus.enumValues)[number];
export type CrawlRunTrigger = (typeof schema.crawlRunTrigger.enumValues)[number];
export type CrawlFieldResultOutcome = (typeof schema.crawlFieldResultOutcome.enumValues)[number];
export type StockStatus = (typeof schema.stockStatus.enumValues)[number];

export interface SelectorSpec {
  selectorId: string;
  versionId: string;
  field: CrawlSelectorField;
  selectorType: CrawlSelectorType;
  expression: string;
  postProcess: Record<string, unknown> | null;
}

export interface SelectorMatch {
  raw: string | null;
  outcome: Extract<CrawlFieldResultOutcome, 'success' | 'selector_missed' | 'parse_failed'>;
  message?: string;
}

export interface FieldExtraction {
  field: CrawlSelectorField;
  versionId: string;
  raw: string | null;
  normalized: string | null;
  outcome: CrawlFieldResultOutcome;
  // Parsed values, only populated on success.
  priceAmount?: number;
  priceCurrency?: string;
  originalPriceAmount?: number;
  stockStatus?: StockStatus;
  stockQuantity?: number | null;
  title?: string;
}
