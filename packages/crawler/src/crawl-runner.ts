import { type SnapshotStorage, snapshotPath } from '@getnextbike/core';
import { type Database, schema } from '@getnextbike/db';
import { and, eq } from 'drizzle-orm';
import type { Fetcher } from './fetcher';
import { normalizePrice, normalizeStock, normalizeTitle } from './postprocess';
import { applySelector } from './selector-engine';
import type {
  CrawlRunStatus,
  CrawlRunTrigger,
  CrawlSelectorField,
  FieldExtraction,
  SelectorSpec,
} from './types';

export interface CrawlTarget {
  inventoryItemId: string;
  resellerLocationId: string;
  productUrl: string;
  storefront: {
    rendersWithJs: boolean | null;
    robotsPolicy: 'respect' | 'ignore_with_consent' | null;
    crawlRateLimitPerMin: number | null;
  };
}

export interface CrawlRunResult {
  crawlRunId: string;
  status: CrawlRunStatus;
  httpStatus: number | null;
  fetchDurationMs: number | null;
  extractions: FieldExtraction[];
}

export interface CrawlRunDeps {
  db: Database;
  fetcher: Fetcher;
  snapshots: SnapshotStorage;
}

// Run one inventory item end-to-end: provisional crawl_runs row → fetch →
// snapshot → apply each active selector → persist observations and final
// status in one transaction. Returns the final result (also written to db).
export async function runInventoryCrawl(
  deps: CrawlRunDeps,
  target: CrawlTarget,
  trigger: CrawlRunTrigger,
): Promise<CrawlRunResult> {
  const { db, fetcher, snapshots } = deps;

  // 1. Provisional crawl_runs row — we need its id to name the snapshot file.
  //    Insert with `failed` so a crash mid-run leaves a truthful trail.
  const [runRow] = await db
    .insert(schema.crawlRuns)
    .values({
      inventoryItemId: target.inventoryItemId,
      status: 'failed',
      trigger,
    })
    .returning({ id: schema.crawlRuns.id });
  if (!runRow) throw new Error('failed to insert crawl_runs row');
  const crawlRunId = runRow.id;

  // 2. Fetch — short-circuits on robots/timeout/http error.
  if (target.storefront.rendersWithJs) {
    // TODO(phase3): Playwright fallback when renders_with_js = true.
    // For now record the run as failed with a clear error class.
    await finalizeRun(db, crawlRunId, {
      status: 'failed',
      httpStatus: null,
      fetchDurationMs: null,
      htmlSnapshotUrl: null,
      errorClass: 'playwright_not_implemented',
      errorMessage: 'renders_with_js requires Playwright (Phase 3)',
    });
    return {
      crawlRunId,
      status: 'failed',
      httpStatus: null,
      fetchDurationMs: null,
      extractions: [],
    };
  }

  const fetchOutcome = await fetcher.fetchPage(target.productUrl, {
    robotsPolicy: target.storefront.robotsPolicy,
  });

  if (!fetchOutcome.ok) {
    const status: CrawlRunStatus =
      fetchOutcome.kind === 'blocked'
        ? 'blocked'
        : fetchOutcome.kind === 'timeout'
          ? 'timeout'
          : 'failed';
    await finalizeRun(db, crawlRunId, {
      status,
      httpStatus: fetchOutcome.httpStatus ?? null,
      fetchDurationMs: fetchOutcome.fetchDurationMs,
      htmlSnapshotUrl: null,
      errorClass: fetchOutcome.errorClass,
      errorMessage: fetchOutcome.errorMessage,
    });
    await touchInventoryItem(db, target.inventoryItemId, { success: false });
    return {
      crawlRunId,
      status,
      httpStatus: fetchOutcome.httpStatus ?? null,
      fetchDurationMs: fetchOutcome.fetchDurationMs,
      extractions: [],
    };
  }

  // 3. Snapshot — best-effort. Failures here don't fail the crawl, but the
  //    snapshot path on crawl_runs stays null so Phase 3 regen knows there's
  //    nothing to load.
  const relativePath = snapshotPath({
    kind: 'inventory',
    resellerLocationId: target.resellerLocationId,
    inventoryItemId: target.inventoryItemId,
    crawlRunId,
  });
  let htmlSnapshotUrl: string | null = null;
  try {
    await snapshots.write(relativePath, fetchOutcome.html);
    htmlSnapshotUrl = relativePath;
  } catch {
    // Continue without a snapshot. Logged by the caller via the returned status.
  }

  // 4. Load active selectors for this storefront.
  const selectorSpecs = await loadActiveSelectors(db, target.resellerLocationId);

  // 5. Apply each selector → postprocess → collect extractions.
  const extractions = selectorSpecs.map((spec) => runSelector(fetchOutcome.html, spec));

  // 6. Persist field results + observations + final status in one tx.
  const finalStatus = computeRunStatus(extractions);
  await db.transaction(async (tx) => {
    for (const ex of extractions) {
      await tx.insert(schema.crawlFieldResults).values({
        crawlRunId,
        field: ex.field,
        selectorVersionId: ex.versionId,
        extractedRaw: ex.raw,
        extractedNormalized: ex.normalized,
        outcome: ex.outcome,
      });
    }

    const price = extractions.find((e) => e.field === 'price');
    const originalPrice = extractions.find((e) => e.field === 'original_price');
    if (price?.priceAmount != null && price.priceCurrency != null) {
      await tx.insert(schema.priceObservations).values({
        inventoryItemId: target.inventoryItemId,
        amount: price.priceAmount.toFixed(2),
        currency: price.priceCurrency,
        originalAmount:
          originalPrice?.originalPriceAmount != null
            ? originalPrice.originalPriceAmount.toFixed(2)
            : null,
        crawlRunId,
      });
    }

    const stock = extractions.find((e) => e.field === 'stock');
    if (stock?.stockStatus) {
      await tx.insert(schema.stockObservations).values({
        inventoryItemId: target.inventoryItemId,
        resellerLocationId: target.resellerLocationId,
        status: stock.stockStatus,
        quantity: stock.stockQuantity ?? null,
        crawlRunId,
      });
    }

    const title = extractions.find((e) => e.field === 'title');
    if (title?.title) {
      await tx
        .update(schema.inventoryItems)
        .set({ titleAtSource: title.title })
        .where(eq(schema.inventoryItems.id, target.inventoryItemId));
    }

    const now = new Date();
    await tx
      .update(schema.inventoryItems)
      .set({
        lastCrawledAt: now,
        ...(finalStatus === 'success' || finalStatus === 'partial' ? { lastSuccessAt: now } : {}),
      })
      .where(eq(schema.inventoryItems.id, target.inventoryItemId));

    await tx
      .update(schema.crawlRuns)
      .set({
        status: finalStatus,
        httpStatus: fetchOutcome.httpStatus,
        fetchDurationMs: fetchOutcome.fetchDurationMs,
        htmlSnapshotUrl,
        finishedAt: now,
      })
      .where(eq(schema.crawlRuns.id, crawlRunId));
  });

  return {
    crawlRunId,
    status: finalStatus,
    httpStatus: fetchOutcome.httpStatus,
    fetchDurationMs: fetchOutcome.fetchDurationMs,
    extractions,
  };
}

function runSelector(html: string, spec: SelectorSpec): FieldExtraction {
  const base: FieldExtraction = {
    field: spec.field,
    versionId: spec.versionId,
    raw: null,
    normalized: null,
    outcome: 'skipped',
  };
  const match = applySelector(html, spec);
  base.raw = match.raw;
  if (match.outcome !== 'success' || match.raw == null) {
    return { ...base, outcome: match.outcome };
  }

  switch (spec.field) {
    case 'price': {
      const parsed = normalizePrice(match.raw, spec.postProcess);
      if (!parsed) return { ...base, outcome: 'parse_failed' };
      if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
        return { ...base, outcome: 'value_implausible' };
      }
      if (!parsed.currency) return { ...base, outcome: 'parse_failed' };
      return {
        ...base,
        outcome: 'success',
        normalized: `${parsed.amount} ${parsed.currency}`,
        priceAmount: parsed.amount,
        priceCurrency: parsed.currency,
      };
    }
    case 'original_price': {
      const parsed = normalizePrice(match.raw, spec.postProcess);
      if (!parsed) return { ...base, outcome: 'parse_failed' };
      if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
        return { ...base, outcome: 'value_implausible' };
      }
      return {
        ...base,
        outcome: 'success',
        normalized: `${parsed.amount} ${parsed.currency ?? ''}`.trim(),
        originalPriceAmount: parsed.amount,
      };
    }
    case 'stock': {
      const status = normalizeStock(match.raw, spec.postProcess);
      return {
        ...base,
        outcome: 'success',
        normalized: status,
        stockStatus: status,
        stockQuantity: null,
      };
    }
    case 'title': {
      const title = normalizeTitle(match.raw);
      if (!title) return { ...base, outcome: 'parse_failed' };
      return { ...base, outcome: 'success', normalized: title, title };
    }
    case 'size_breakdown':
      // TODO(phase3): structured size_breakdown extraction. For now we record
      // the raw match but don't decode it.
      return { ...base, outcome: 'success', normalized: match.raw };
    default: {
      const _exhaustive: never = spec.field;
      return { ...base, outcome: 'skipped', normalized: `unhandled field ${_exhaustive}` };
    }
  }
}

function computeRunStatus(extractions: FieldExtraction[]): CrawlRunStatus {
  if (extractions.length === 0) return 'success';
  const successes = extractions.filter((e) => e.outcome === 'success').length;
  if (successes === extractions.length) return 'success';
  if (successes === 0) return 'failed';
  return 'partial';
}

async function loadActiveSelectors(
  db: Database,
  resellerLocationId: string,
): Promise<SelectorSpec[]> {
  const rows = await db
    .select({
      selectorId: schema.crawlSelectors.id,
      field: schema.crawlSelectors.field,
      versionId: schema.crawlSelectorVersions.id,
      selectorType: schema.crawlSelectorVersions.selectorType,
      expression: schema.crawlSelectorVersions.expression,
      postProcessJson: schema.crawlSelectorVersions.postProcessJson,
    })
    .from(schema.crawlSelectors)
    .innerJoin(
      schema.crawlSelectorVersions,
      eq(schema.crawlSelectorVersions.id, schema.crawlSelectors.currentVersionId),
    )
    .where(
      and(
        eq(schema.crawlSelectors.resellerLocationId, resellerLocationId),
        eq(schema.crawlSelectors.status, 'active'),
      ),
    );
  return rows.map((r) => ({
    selectorId: r.selectorId,
    versionId: r.versionId,
    field: r.field as CrawlSelectorField,
    selectorType: r.selectorType,
    expression: r.expression,
    postProcess: (r.postProcessJson as Record<string, unknown> | null) ?? null,
  }));
}

async function finalizeRun(
  db: Database,
  crawlRunId: string,
  patch: {
    status: CrawlRunStatus;
    httpStatus: number | null;
    fetchDurationMs: number | null;
    htmlSnapshotUrl: string | null;
    errorClass: string | null;
    errorMessage: string | null;
  },
): Promise<void> {
  await db
    .update(schema.crawlRuns)
    .set({
      status: patch.status,
      httpStatus: patch.httpStatus,
      fetchDurationMs: patch.fetchDurationMs,
      htmlSnapshotUrl: patch.htmlSnapshotUrl,
      errorClass: patch.errorClass,
      errorMessage: patch.errorMessage,
      finishedAt: new Date(),
    })
    .where(eq(schema.crawlRuns.id, crawlRunId));
}

async function touchInventoryItem(
  db: Database,
  itemId: string,
  opts: { success: boolean },
): Promise<void> {
  await db
    .update(schema.inventoryItems)
    .set({
      lastCrawledAt: new Date(),
      ...(opts.success ? { lastSuccessAt: new Date() } : {}),
    })
    .where(eq(schema.inventoryItems.id, itemId));
}
