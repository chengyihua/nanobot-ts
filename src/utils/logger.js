"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
const pino_1 = require("pino");
// Base logger; pretty-print can be enabled via PINO_PRETTY env in local dev
const base = (0, pino_1.pino)({
    level: process.env.LOG_LEVEL || 'info',
    base: undefined,
    transport: process.env.PINO_PRETTY
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
        }
        : undefined,
});
function createLogger(module, bindings = {}) {
    return base.child({ module, ...bindings });
}
exports.logger = base;
