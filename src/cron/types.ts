import { z } from 'zod';

export const CronScheduleSchema = z.object({
  kind: z.enum(['at', 'every', 'cron']),
  at_ms: z.number().optional(),
  every_ms: z.number().optional(),
  expr: z.string().optional(),
  tz: z.string().optional(),
});

export type CronSchedule = z.infer<typeof CronScheduleSchema>;

export const CronPayloadSchema = z.object({
  kind: z.enum(['agent_turn']).default('agent_turn'),
  message: z.string(),
  deliver: z.boolean().default(false),
  channel: z.string().optional(),
  to: z.string().optional(),
});

export type CronPayload = z.infer<typeof CronPayloadSchema>;

export const CronJobStateSchema = z.object({
  next_run_at_ms: z.number().nullable().optional(),
  last_run_at_ms: z.number().nullable().optional(),
  last_status: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
});

export type CronJobState = z.infer<typeof CronJobStateSchema>;

export const CronJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  schedule: CronScheduleSchema,
  payload: CronPayloadSchema,
  state: CronJobStateSchema,
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
  delete_after_run: z.boolean().default(false),
});

export type CronJob = z.infer<typeof CronJobSchema>;

export const CronStoreSchema = z.object({
  version: z.number().default(1),
  jobs: z.array(CronJobSchema).default([]),
});

export type CronStore = z.infer<typeof CronStoreSchema>;
