"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronStoreSchema = exports.CronJobSchema = exports.CronJobStateSchema = exports.CronPayloadSchema = exports.CronScheduleSchema = void 0;
const zod_1 = require("zod");
exports.CronScheduleSchema = zod_1.z.object({
    kind: zod_1.z.enum(['at', 'every', 'cron']),
    at_ms: zod_1.z.number().optional(),
    every_ms: zod_1.z.number().optional(),
    expr: zod_1.z.string().optional(),
    tz: zod_1.z.string().optional(),
});
exports.CronPayloadSchema = zod_1.z.object({
    kind: zod_1.z.enum(['agent_turn']).default('agent_turn'),
    message: zod_1.z.string(),
    deliver: zod_1.z.boolean().default(false),
    channel: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
});
exports.CronJobStateSchema = zod_1.z.object({
    next_run_at_ms: zod_1.z.number().nullable().optional(),
    last_run_at_ms: zod_1.z.number().nullable().optional(),
    last_status: zod_1.z.string().nullable().optional(),
    last_error: zod_1.z.string().nullable().optional(),
});
exports.CronJobSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    enabled: zod_1.z.boolean().default(true),
    schedule: exports.CronScheduleSchema,
    payload: exports.CronPayloadSchema,
    state: exports.CronJobStateSchema,
    created_at_ms: zod_1.z.number(),
    updated_at_ms: zod_1.z.number(),
    delete_after_run: zod_1.z.boolean().default(false),
});
exports.CronStoreSchema = zod_1.z.object({
    version: zod_1.z.number().default(1),
    jobs: zod_1.z.array(exports.CronJobSchema).default([]),
});
