import { createServer } from 'node:http';
import type { Logger } from 'pino';

export interface HealthState {
  lastHeartbeatAt: Date | null;
  lastTickAt: Date | null;
  lastSweepAt: Date | null;
}

export function startHealthServer(port: number, state: HealthState, logger: Logger) {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      const now = Date.now();
      const last = state.lastHeartbeatAt?.getTime() ?? 0;
      const stale = now - last > 60_000;
      const body = {
        status: stale ? 'degraded' : 'ok',
        lastHeartbeatAt: state.lastHeartbeatAt?.toISOString() ?? null,
        lastTickAt: state.lastTickAt?.toISOString() ?? null,
        lastSweepAt: state.lastSweepAt?.toISOString() ?? null,
      };
      res.writeHead(stale ? 503 : 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, () => logger.info({ port }, 'worker health server listening'));
  return server;
}
