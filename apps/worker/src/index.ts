import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FsSnapshotStorage } from '@getnextbike/core';
import { Fetcher } from '@getnextbike/crawler';
import { createDb } from '@getnextbike/db';
import { sql } from 'drizzle-orm';
import { type HealthState, startHealthServer } from './health';
import { logger } from './logger';
import { createScheduler } from './scheduler';
import { createSweeper } from './snapshot-sweeper';

// Match apps/web: load the repo-root .env so both apps share one config file.
// @next/env is CJS — createRequire is the portable ESM-from-CJS path.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnvConfig(repoRoot);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.fatal('DATABASE_URL is required');
  process.exit(1);
}

const healthPort = Number.parseInt(process.env.WORKER_HEALTH_PORT ?? '3100', 10);
const heartbeatMs = Number.parseInt(process.env.WORKER_HEARTBEAT_MS ?? '30000', 10);
const tickMs = Number.parseInt(process.env.WORKER_TICK_MS ?? '30000', 10);
const batchSize = Number.parseInt(process.env.WORKER_BATCH_SIZE ?? '50', 10);
const intervalMinutes = Number.parseInt(process.env.INVENTORY_CRAWL_INTERVAL_MINUTES ?? '360', 10);
const snapshotsDir = process.env.SNAPSHOTS_DIR ?? '/var/lib/getnextbike/snapshots';
const fetchTimeoutMs = Number.parseInt(process.env.WORKER_FETCH_TIMEOUT_MS ?? '30000', 10);
const userAgent = process.env.WORKER_USER_AGENT ?? 'GetNextBikeBot/1.0 (+https://getnextbike.app)';
const sweepIntervalMs = Number.parseInt(
  process.env.WORKER_SWEEP_INTERVAL_MS ?? `${60 * 60 * 1000}`,
  10,
);
const retentionDays = Number.parseInt(process.env.SNAPSHOT_RETENTION_DAYS ?? '7', 10);

const db = createDb(databaseUrl, { max: 4 });
const snapshots = new FsSnapshotStorage(snapshotsDir);
const fetcher = new Fetcher({ userAgent, timeoutMs: fetchTimeoutMs });

const state: HealthState = { lastHeartbeatAt: null, lastTickAt: null, lastSweepAt: null };
startHealthServer(healthPort, state, logger);

const heartbeat = setInterval(async () => {
  try {
    await db.execute(sql`select 1`);
    state.lastHeartbeatAt = new Date();
  } catch (err) {
    logger.error({ err }, 'heartbeat failed');
  }
}, heartbeatMs);

void (async () => {
  try {
    await db.execute(sql`select 1`);
    state.lastHeartbeatAt = new Date();
  } catch (err) {
    logger.error({ err }, 'initial heartbeat failed');
  }
})();

const scheduler = createScheduler(
  {
    db,
    fetcher,
    snapshots,
    logger: logger.child({ component: 'scheduler' }),
  },
  { tickMs, batchSize, intervalMinutes },
);

// Wrap tick so /health knows the last successful tick time.
const originalTick = scheduler.tick;
scheduler.tick = async () => {
  const r = await originalTick();
  state.lastTickAt = new Date();
  return r;
};
scheduler.start();

const sweeper = createSweeper(
  { db, logger: logger.child({ component: 'sweeper' }) },
  { rootDir: snapshotsDir, retentionDays, intervalMs: sweepIntervalMs },
);
const originalSweep = sweeper.sweep;
sweeper.sweep = async () => {
  const r = await originalSweep();
  state.lastSweepAt = new Date();
  return r;
};
sweeper.start();
// Kick off one sweep at startup so retention is enforced even if the process
// is restarted more often than `sweepIntervalMs`.
void sweeper.sweep().catch((err) => logger.error({ err }, 'initial snapshot sweep failed'));

logger.info(
  {
    heartbeatMs,
    tickMs,
    batchSize,
    intervalMinutes,
    snapshotsDir,
    retentionDays,
    sweepIntervalMs,
  },
  'worker started',
);

function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down');
  scheduler.stop();
  sweeper.stop();
  clearInterval(heartbeat);
  setTimeout(() => process.exit(0), 250).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
