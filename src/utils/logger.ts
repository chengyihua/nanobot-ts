import { pino } from 'pino';

// Base logger; pretty-print can be enabled via PINO_PRETTY env in local dev
const base = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined,
  transport: process.env.PINO_PRETTY
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      }
    : undefined,
});

export function createLogger(module: string, bindings: Record<string, any> = {}) {
  return base.child({ module, ...bindings });
}

export const logger = base;
