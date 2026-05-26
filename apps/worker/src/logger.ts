import pino from 'pino';

const logDir = process.env.LOG_DIR;
const transport =
  logDir && process.env.NODE_ENV === 'production'
    ? pino.transport({
        targets: [
          { target: 'pino/file', options: { destination: `${logDir}/worker.log`, mkdir: true } },
          { target: 'pino/file', options: { destination: 1 } }, // stdout
        ],
      })
    : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
    base: { service: 'worker' },
  },
  transport,
);
