import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '@getnextbike/db';
import { sql } from 'drizzle-orm';
import { type HealthState, startHealthServer } from './health';
import { logger } from './logger';

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

const db = createDb(databaseUrl, { max: 4 });
const state: HealthState = { lastHeartbeatAt: null };

startHealthServer(healthPort, state, logger);

logger.info({ heartbeatMs }, 'worker starting');

const heartbeat = setInterval(async () => {
  try {
    await db.execute(sql`select 1`);
    state.lastHeartbeatAt = new Date();
    logger.debug('heartbeat ok');
  } catch (err) {
    logger.error({ err }, 'heartbeat failed');
  }
}, heartbeatMs);

// Kick off an immediate heartbeat so /health reports ok on first request.
void (async () => {
  try {
    await db.execute(sql`select 1`);
    state.lastHeartbeatAt = new Date();
  } catch (err) {
    logger.error({ err }, 'initial heartbeat failed');
  }
})();

function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down');
  clearInterval(heartbeat);
  setTimeout(() => process.exit(0), 250).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
