import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { type Database, schema } from '@getnextbike/db';
import { desc, ne, sql } from 'drizzle-orm';
import type { Logger } from 'pino';

export interface SweeperConfig {
  rootDir: string;
  retentionDays: number;
  intervalMs: number;
}

export interface SweeperDeps {
  db: Database;
  logger: Logger;
}

// Hourly sweep over the inventory snapshot tree. Files older than
// retentionDays are deleted unless their crawl_run_id is the most recent
// successful OR most recent non-successful run for the item (the "pinned"
// pair from spec §3.4). Catalog snapshots aren't produced in Phase 2, so we
// only walk `inventory/`.
export function createSweeper(deps: SweeperDeps, cfg: SweeperConfig) {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  async function sweep(): Promise<{ deleted: number; kept: number }> {
    if (running) return { deleted: 0, kept: 0 };
    running = true;
    try {
      return await runSweep(deps, cfg);
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      sweep().catch((err) => deps.logger.error({ err }, 'snapshot sweep failed'));
    }, cfg.intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop, sweep };
}

async function runSweep(
  { db, logger }: SweeperDeps,
  cfg: SweeperConfig,
): Promise<{ deleted: number; kept: number }> {
  const inventoryRoot = path.join(cfg.rootDir, 'inventory');
  const exists = await dirExists(inventoryRoot);
  if (!exists) return { deleted: 0, kept: 0 };

  const cutoffMs = Date.now() - cfg.retentionDays * 24 * 60 * 60 * 1000;
  const pinned = await loadPinnedRunIds(db);

  let deleted = 0;
  let kept = 0;
  for (const locId of await readdir(inventoryRoot)) {
    const locDir = path.join(inventoryRoot, locId);
    if (!(await isDir(locDir))) continue;
    for (const itemId of await readdir(locDir)) {
      const itemDir = path.join(locDir, itemId);
      if (!(await isDir(itemDir))) continue;
      for (const file of await readdir(itemDir)) {
        const filePath = path.join(itemDir, file);
        const runId = file.replace(/\.html$/, '');
        if (pinned.has(runId)) {
          kept++;
          continue;
        }
        const st = await stat(filePath).catch(() => null);
        if (!st?.isFile()) continue;
        if (st.mtimeMs < cutoffMs) {
          await unlink(filePath).catch((err) =>
            logger.warn({ err, filePath }, 'failed to unlink snapshot'),
          );
          deleted++;
        } else {
          kept++;
        }
      }
    }
  }

  logger.info({ deleted, kept, retentionDays: cfg.retentionDays }, 'snapshot sweep done');
  return { deleted, kept };
}

// One row per (item, success-bucket) returning the most recent run id. We
// build a Set of every id that should NOT be deleted.
async function loadPinnedRunIds(db: Database): Promise<Set<string>> {
  const pinned = new Set<string>();
  const latestSuccess = await db
    .selectDistinctOn([schema.crawlRuns.inventoryItemId], {
      id: schema.crawlRuns.id,
    })
    .from(schema.crawlRuns)
    .where(sql`${schema.crawlRuns.status} = 'success'`)
    .orderBy(schema.crawlRuns.inventoryItemId, desc(schema.crawlRuns.startedAt));
  for (const r of latestSuccess) pinned.add(r.id);

  const latestFailure = await db
    .selectDistinctOn([schema.crawlRuns.inventoryItemId], {
      id: schema.crawlRuns.id,
    })
    .from(schema.crawlRuns)
    .where(ne(schema.crawlRuns.status, 'success'))
    .orderBy(schema.crawlRuns.inventoryItemId, desc(schema.crawlRuns.startedAt));
  for (const r of latestFailure) pinned.add(r.id);

  return pinned;
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
