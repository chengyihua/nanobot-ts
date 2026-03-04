import fs from 'fs-extra';
import path from 'path';
import cronParser from 'cron-parser';
import { CronJob, CronSchedule, CronStore, CronStoreSchema } from './types.js';
import { v4 as uuidv4 } from 'uuid';

function nowMs(): number {
  return Date.now();
}

function computeNextRun(schedule: CronSchedule, now_ms: number): number | null {
  if (schedule.kind === 'at') {
    return schedule.at_ms && schedule.at_ms > now_ms ? schedule.at_ms : null;
  }

  if (schedule.kind === 'every') {
    if (!schedule.every_ms || schedule.every_ms <= 0) return null;
    return now_ms + schedule.every_ms;
  }

  if (schedule.kind === 'cron' && schedule.expr) {
    try {
      const interval = cronParser.parseExpression(schedule.expr, {
        currentDate: new Date(now_ms),
        tz: schedule.tz,
      });
      return interval.next().getTime();
    } catch (error) {
      console.error('Failed to parse cron expression:', schedule.expr, error);
      return null;
    }
  }

  return null;
}

export type JobCallback = (job: CronJob) => Promise<string | null>;

export class CronService {
  private storePath: string;
  private onJob?: JobCallback;
  private onUpdate?: () => void;
  private store: CronStore | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private loadingPromise: Promise<CronStore> | null = null;

  constructor(storePath: string, onJob?: JobCallback, onUpdate?: () => void) {
    this.storePath = storePath;
    this.onJob = onJob;
    this.onUpdate = onUpdate;
  }

  private async loadStore(): Promise<CronStore> {
    if (this.store) return this.store;

    // Use a simple lock or ensure we don't load multiple times simultaneously
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      if (await fs.pathExists(this.storePath)) {
        try {
          const data = await fs.readJson(this.storePath);
          const result = CronStoreSchema.safeParse(data);
          if (result.success) {
            this.store = result.data;
          } else {
            console.warn('Failed to validate cron store, using empty store:', result.error);
            this.store = { version: 1, jobs: [] };
          }
        } catch (error) {
          console.warn('Failed to load cron store, using empty store:', error);
          this.store = { version: 1, jobs: [] };
        }
      } else {
        this.store = { version: 1, jobs: [] };
      }
      this.loadingPromise = null;
      return this.store;
    })();

    return this.loadingPromise;
  }

  private async saveStore(): Promise<void> {
    if (!this.store) return;
    await fs.ensureDir(path.dirname(this.storePath));
    await fs.writeJson(this.storePath, this.store, { spaces: 2 });
    if (this.onUpdate) {
      this.onUpdate();
    }
  }

  public async reload(): Promise<void> {
    console.log('[Cron] Reloading store from disk...');
    this.store = null;
    const store = await this.loadStore();
    this.recomputeNextRuns();
    if (this.running) {
      this.armTimer();
    }
    console.log(`[Cron] Reload complete. Active jobs: ${store.jobs.length || 0}`);
  }

  public async start(): Promise<void> {
    this.running = true;
    this.store = null; // Force reload from disk
    await this.loadStore();
    this.recomputeNextRuns();
    await this.saveStore();
    this.armTimer();
    const store = this.store as unknown as CronStore;
    const jobCount = store?.jobs?.length || 0;
    console.log(`[Cron] Service started with ${jobCount} jobs`);
  }

  public stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private recomputeNextRuns(): void {
    if (!this.store) return;
    const now = nowMs();
    for (const job of this.store.jobs) {
      if (job.enabled) {
        job.state.next_run_at_ms = computeNextRun(job.schedule, now);
      }
    }
  }

  private getNextWakeMs(): number | null {
    if (!this.store) return null;
    const times = this.store.jobs
      .filter(j => j.enabled && j.state.next_run_at_ms)
      .map(j => j.state.next_run_at_ms as number);
    
    return times.length > 0 ? Math.min(...times) : null;
  }

  private armTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const nextWake = this.getNextWakeMs();
    if (!nextWake || !this.running) return;

    const now = nowMs();
    let delayMs = Math.max(0, nextWake - now);
    
    // Node.js setTimeout limit is 2^31 - 1 (~24.8 days)
    // 31528830266 is clearly too large. We cap it to 1 hour and wake up early to re-check.
    const SAFE_MAX_DELAY = 3600000; // 1 hour
    
    if (delayMs > SAFE_MAX_DELAY) {
      delayMs = SAFE_MAX_DELAY;
    }
    
    this.timer = setTimeout(async () => {
      if (this.running) {
        await this.onTimer();
      }
    }, delayMs);
  }

  private async onTimer(): Promise<void> {
    if (!this.store) return;

    const now = nowMs();
    const dueJobs = this.store.jobs.filter(
      j => j.enabled && j.state.next_run_at_ms && now >= j.state.next_run_at_ms
    );

    for (const job of dueJobs) {
      await this.executeJob(job);
    }

    await this.saveStore();
    this.armTimer();
  }

  private async executeJob(job: CronJob): Promise<void> {
    const startMs = nowMs();
    console.log(`[Cron] Executing job '${job.name}' (${job.id})`);

    try {
      if (this.onJob) {
        await this.onJob(job);
      }
      job.state.last_status = 'ok';
      job.state.last_error = null;
      console.log(`[Cron] Job '${job.name}' completed`);
    } catch (error: any) {
      job.state.last_status = 'error';
      job.state.last_error = error.message;
      console.error(`[Cron] Job '${job.name}' failed:`, error);
    }

    job.state.last_run_at_ms = startMs;
    job.updated_at_ms = nowMs();

    if (job.schedule.kind === 'at') {
      if (job.delete_after_run) {
        this.store!.jobs = this.store!.jobs.filter(j => j.id !== job.id);
      } else {
        job.enabled = false;
        job.state.next_run_at_ms = null;
      }
    } else {
      job.state.next_run_at_ms = computeNextRun(job.schedule, nowMs());
    }
  }

  // --- Public API ---

  public async listJobs(includeDisabled = false): Promise<CronJob[]> {
    const store = await this.loadStore();
    const jobs = includeDisabled ? store.jobs : store.jobs.filter(j => j.enabled);
    return [...jobs].sort((a, b) => (a.state.next_run_at_ms || Infinity) - (b.state.next_run_at_ms || Infinity));
  }

  public async addJob(params: {
    name: string;
    schedule: CronSchedule;
    kind?: 'agent_turn' | 'system_task';
    message?: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
    task?: string;
    taskParams?: Record<string, any>;
    delete_after_run?: boolean;
  }): Promise<CronJob> {
    const store = await this.loadStore();
    const now = nowMs();
    const kind = params.kind || 'agent_turn';

    // Check for duplicates
    const existingJob = store.jobs.find(j => {
      // Compare payload
      if (j.payload.kind !== kind) return false;

      if (kind === 'agent_turn') {
        if (j.payload.kind === 'agent_turn') {
          if (j.payload.message !== params.message || 
              j.payload.channel !== params.channel || 
              j.payload.to !== params.to) {
            return false;
          }
        }
      } else if (kind === 'system_task') {
        if (j.payload.kind === 'system_task') {
           if (j.payload.task !== params.task) {
             return false;
           }
        }
      }

      // Compare schedule
      if (j.schedule.kind !== params.schedule.kind) return false;
      
      // For 'at' schedule, we allow some tolerance (e.g., 5 seconds) to handle duplicate tool calls
      // that might have slightly different timestamps due to Date.now() being called at different times.
      if (j.schedule.kind === 'at') {
        const diff = Math.abs((j.schedule.at_ms || 0) - (params.schedule.at_ms || 0));
        if (diff > 5000) return false; // More than 5 seconds difference
      } else if (j.schedule.kind === 'every' && j.schedule.every_ms !== params.schedule.every_ms) {
        return false;
      } else if (j.schedule.kind === 'cron' && (j.schedule.expr !== params.schedule.expr || j.schedule.tz !== params.schedule.tz)) {
        return false;
      }
      
      return true;
    });

    if (existingJob) {
      console.log(`[Cron] Job already exists: '${existingJob.name}' (${existingJob.id})`);
      // If it's disabled, re-enable it
      if (!existingJob.enabled) {
        existingJob.enabled = true;
        existingJob.state.next_run_at_ms = computeNextRun(existingJob.schedule, now);
        existingJob.updated_at_ms = now;
        await this.saveStore();
        this.armTimer();
      }
      return existingJob;
    }

    let payload: any;
    if (kind === 'system_task') {
      payload = {
        kind: 'system_task',
        task: params.task || 'unknown_task',
        params: params.taskParams,
      };
    } else {
      payload = {
        kind: 'agent_turn',
        message: params.message || '',
        deliver: params.deliver || false,
        channel: params.channel,
        to: params.to,
      };
    }

    const job: CronJob = {
      id: uuidv4().substring(0, 8),
      name: params.name,
      enabled: true,
      schedule: params.schedule,
      payload,
      state: {
        next_run_at_ms: computeNextRun(params.schedule, now),
      },
      created_at_ms: now,
      updated_at_ms: now,
      delete_after_run: params.delete_after_run || false,
    };

    store.jobs.push(job);
    await this.saveStore();
    this.armTimer();

    console.log(`[Cron] Added job '${job.name}' (${job.id})`);
    return job;
  }

  public async removeJob(id: string): Promise<boolean> {
    const store = await this.loadStore();
    const initialLength = store.jobs.length;
    store.jobs = store.jobs.filter(j => j.id !== id);
    
    if (store.jobs.length !== initialLength) {
      await this.saveStore();
      this.recomputeNextRuns();
      this.armTimer();
      console.log(`[Cron] Removed job '${id}'`);
      return true;
    }
    
    return false;
  }


  public async getStatus() {
    const store = await this.loadStore();
    return {
      enabled: this.running,
      jobs: store.jobs.length,
      next_wake_at_ms: this.getNextWakeMs(),
    };
  }
}
