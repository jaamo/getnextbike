import type { SnapshotStorage } from '@getnextbike/core';
import { type Fetcher, runInventoryCrawl } from '@getnextbike/crawler';
import { type Database, schema } from '@getnextbike/db';
import { and, asc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Logger } from 'pino';

export interface SchedulerConfig {
  // How often the scheduler tick fires (ms).
  tickMs: number;
  // Max inventory items processed per tick (across all storefronts).
  batchSize: number;
  // Default per-item recrawl interval (minutes). Used when no storefront-level
  // override exists; per-item intervals will land in a later phase.
  intervalMinutes: number;
}

export interface SchedulerDeps {
  db: Database;
  fetcher: Fetcher;
  snapshots: SnapshotStorage;
  logger: Logger;
}

export function createScheduler(deps: SchedulerDeps, cfg: SchedulerConfig) {
  let running = false;
  let timer: NodeJS.Timeout | null = null;

  async function tick(): Promise<{ processed: number; storefronts: number }> {
    if (running) return { processed: 0, storefronts: 0 };
    running = true;
    try {
      return await runTick(deps, cfg);
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      tick().catch((err) => deps.logger.error({ err }, 'scheduler tick failed'));
    }, cfg.tickMs);
    // Kick off an immediate tick so we don't wait `tickMs` to start working.
    tick().catch((err) => deps.logger.error({ err }, 'initial scheduler tick failed'));
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop, tick };
}

interface DueItem {
  itemId: string;
  productUrl: string;
  resellerLocationId: string;
  rendersWithJs: boolean | null;
  robotsPolicy: 'respect' | 'ignore_with_consent' | null;
  crawlRateLimitPerMin: number | null;
}

async function runTick(
  { db, fetcher, snapshots, logger }: SchedulerDeps,
  cfg: SchedulerConfig,
): Promise<{ processed: number; storefronts: number }> {
  const cutoff = new Date(Date.now() - cfg.intervalMinutes * 60_000);

  const rows: DueItem[] = await db
    .select({
      itemId: schema.inventoryItems.id,
      productUrl: schema.inventoryItems.productUrl,
      resellerLocationId: schema.inventoryItems.resellerLocationId,
      rendersWithJs: schema.resellerLocations.rendersWithJs,
      robotsPolicy: schema.resellerLocations.robotsPolicy,
      crawlRateLimitPerMin: schema.resellerLocations.crawlRateLimitPerMin,
    })
    .from(schema.inventoryItems)
    .innerJoin(
      schema.resellerLocations,
      eq(schema.inventoryItems.resellerLocationId, schema.resellerLocations.id),
    )
    .where(
      and(
        eq(schema.inventoryItems.status, 'live'),
        eq(schema.resellerLocations.status, 'active'),
        or(
          isNull(schema.inventoryItems.lastCrawledAt),
          lt(schema.inventoryItems.lastCrawledAt, cutoff),
        ),
      ),
    )
    .orderBy(
      // Nulls-first so brand-new items are processed before stale ones.
      sql`${schema.inventoryItems.lastCrawledAt} asc nulls first`,
      asc(schema.inventoryItems.id),
    )
    .limit(cfg.batchSize);

  if (rows.length === 0) return { processed: 0, storefronts: 0 };

  // Group by storefront so per-storefront rate limits work.
  const groups = new Map<string, DueItem[]>();
  for (const row of rows) {
    const g = groups.get(row.resellerLocationId) ?? [];
    g.push(row);
    groups.set(row.resellerLocationId, g);
  }

  logger.info({ items: rows.length, storefronts: groups.size }, 'scheduler tick: starting batch');

  let processed = 0;
  await Promise.all(
    [...groups.values()].map(async (group) => {
      const minDelayMs = group[0]?.crawlRateLimitPerMin
        ? Math.ceil(60_000 / Math.max(1, group[0].crawlRateLimitPerMin))
        : 0;
      for (let i = 0; i < group.length; i++) {
        const item = group[i];
        if (!item) continue;
        try {
          const result = await runInventoryCrawl(
            { db, fetcher, snapshots },
            {
              inventoryItemId: item.itemId,
              resellerLocationId: item.resellerLocationId,
              productUrl: item.productUrl,
              storefront: {
                rendersWithJs: item.rendersWithJs,
                robotsPolicy: item.robotsPolicy,
                crawlRateLimitPerMin: item.crawlRateLimitPerMin,
              },
            },
            'schedule',
          );
          processed++;
          logger.debug(
            { itemId: item.itemId, status: result.status, ms: result.fetchDurationMs },
            'crawl finished',
          );
        } catch (err) {
          logger.error({ err, itemId: item.itemId }, 'crawl threw');
        }
        if (i < group.length - 1 && minDelayMs > 0) {
          await sleep(minDelayMs);
        }
      }
    }),
  );

  logger.info({ processed, storefronts: groups.size }, 'scheduler tick: done');
  return { processed, storefronts: groups.size };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
