"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronService = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const cron_parser_1 = __importDefault(require("cron-parser"));
const types_js_1 = require("./types.js");
const uuid_1 = require("uuid");
function nowMs() {
    return Date.now();
}
function computeNextRun(schedule, now_ms) {
    if (schedule.kind === 'at') {
        return schedule.at_ms && schedule.at_ms > now_ms ? schedule.at_ms : null;
    }
    if (schedule.kind === 'every') {
        if (!schedule.every_ms || schedule.every_ms <= 0)
            return null;
        return now_ms + schedule.every_ms;
    }
    if (schedule.kind === 'cron' && schedule.expr) {
        try {
            const interval = cron_parser_1.default.parseExpression(schedule.expr, {
                currentDate: new Date(now_ms),
                tz: schedule.tz,
            });
            return interval.next().getTime();
        }
        catch (error) {
            console.error('Failed to parse cron expression:', schedule.expr, error);
            return null;
        }
    }
    return null;
}
class CronService {
    constructor(storePath, onJob, onUpdate) {
        this.store = null;
        this.timer = null;
        this.running = false;
        this.loadingPromise = null;
        this.storePath = storePath;
        this.onJob = onJob;
        this.onUpdate = onUpdate;
    }
    async loadStore() {
        if (this.store)
            return this.store;
        // Use a simple lock or ensure we don't load multiple times simultaneously
        if (this.loadingPromise)
            return this.loadingPromise;
        this.loadingPromise = (async () => {
            if (await fs_extra_1.default.pathExists(this.storePath)) {
                try {
                    const data = await fs_extra_1.default.readJson(this.storePath);
                    const result = types_js_1.CronStoreSchema.safeParse(data);
                    if (result.success) {
                        this.store = result.data;
                    }
                    else {
                        console.warn('Failed to validate cron store, using empty store:', result.error);
                        this.store = { version: 1, jobs: [] };
                    }
                }
                catch (error) {
                    console.warn('Failed to load cron store, using empty store:', error);
                    this.store = { version: 1, jobs: [] };
                }
            }
            else {
                this.store = { version: 1, jobs: [] };
            }
            this.loadingPromise = null;
            return this.store;
        })();
        return this.loadingPromise;
    }
    async saveStore() {
        if (!this.store)
            return;
        await fs_extra_1.default.ensureDir(path_1.default.dirname(this.storePath));
        await fs_extra_1.default.writeJson(this.storePath, this.store, { spaces: 2 });
        if (this.onUpdate) {
            this.onUpdate();
        }
    }
    async reload() {
        console.log('[Cron] Reloading store from disk...');
        this.store = null;
        const store = await this.loadStore();
        this.recomputeNextRuns();
        if (this.running) {
            this.armTimer();
        }
        console.log(`[Cron] Reload complete. Active jobs: ${store.jobs.length || 0}`);
    }
    async start() {
        this.running = true;
        await this.loadStore();
        this.recomputeNextRuns();
        await this.saveStore();
        this.armTimer();
        console.log(`[Cron] Service started with ${this.store?.jobs.length || 0} jobs`);
    }
    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    recomputeNextRuns() {
        if (!this.store)
            return;
        const now = nowMs();
        for (const job of this.store.jobs) {
            if (job.enabled) {
                job.state.next_run_at_ms = computeNextRun(job.schedule, now);
            }
        }
    }
    getNextWakeMs() {
        if (!this.store)
            return null;
        const times = this.store.jobs
            .filter(j => j.enabled && j.state.next_run_at_ms)
            .map(j => j.state.next_run_at_ms);
        return times.length > 0 ? Math.min(...times) : null;
    }
    armTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const nextWake = this.getNextWakeMs();
        if (!nextWake || !this.running)
            return;
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
    async onTimer() {
        if (!this.store)
            return;
        const now = nowMs();
        const dueJobs = this.store.jobs.filter(j => j.enabled && j.state.next_run_at_ms && now >= j.state.next_run_at_ms);
        for (const job of dueJobs) {
            await this.executeJob(job);
        }
        await this.saveStore();
        this.armTimer();
    }
    async executeJob(job) {
        const startMs = nowMs();
        console.log(`[Cron] Executing job '${job.name}' (${job.id})`);
        try {
            if (this.onJob) {
                await this.onJob(job);
            }
            job.state.last_status = 'ok';
            job.state.last_error = null;
            console.log(`[Cron] Job '${job.name}' completed`);
        }
        catch (error) {
            job.state.last_status = 'error';
            job.state.last_error = error.message;
            console.error(`[Cron] Job '${job.name}' failed:`, error);
        }
        job.state.last_run_at_ms = startMs;
        job.updated_at_ms = nowMs();
        if (job.schedule.kind === 'at') {
            if (job.delete_after_run) {
                this.store.jobs = this.store.jobs.filter(j => j.id !== job.id);
            }
            else {
                job.enabled = false;
                job.state.next_run_at_ms = null;
            }
        }
        else {
            job.state.next_run_at_ms = computeNextRun(job.schedule, nowMs());
        }
    }
    // --- Public API ---
    async listJobs(includeDisabled = false) {
        const store = await this.loadStore();
        const jobs = includeDisabled ? store.jobs : store.jobs.filter(j => j.enabled);
        return [...jobs].sort((a, b) => (a.state.next_run_at_ms || Infinity) - (b.state.next_run_at_ms || Infinity));
    }
    async addJob(params) {
        const store = await this.loadStore();
        const now = nowMs();
        // Check for duplicates
        const existingJob = store.jobs.find(j => {
            // Compare payload
            if (j.payload.message !== params.message ||
                j.payload.channel !== params.channel ||
                j.payload.to !== params.to) {
                return false;
            }
            // Compare schedule
            if (j.schedule.kind !== params.schedule.kind)
                return false;
            // For 'at' schedule, we allow some tolerance (e.g., 5 seconds) to handle duplicate tool calls
            // that might have slightly different timestamps due to Date.now() being called at different times.
            if (j.schedule.kind === 'at') {
                const diff = Math.abs((j.schedule.at_ms || 0) - (params.schedule.at_ms || 0));
                if (diff > 5000)
                    return false; // More than 5 seconds difference
            }
            else if (j.schedule.kind === 'every' && j.schedule.every_ms !== params.schedule.every_ms) {
                return false;
            }
            else if (j.schedule.kind === 'cron' && (j.schedule.expr !== params.schedule.expr || j.schedule.tz !== params.schedule.tz)) {
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
        const job = {
            id: (0, uuid_1.v4)().substring(0, 8),
            name: params.name,
            enabled: true,
            schedule: params.schedule,
            payload: {
                kind: 'agent_turn',
                message: params.message,
                deliver: params.deliver || false,
                channel: params.channel,
                to: params.to,
            },
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
    async removeJob(jobId) {
        const store = await this.loadStore();
        const beforeCount = store.jobs.length;
        store.jobs = store.jobs.filter(j => j.id !== jobId);
        const removed = store.jobs.length < beforeCount;
        if (removed) {
            await this.saveStore();
            this.armTimer();
            console.log(`[Cron] Removed job ${jobId}`);
        }
        return removed;
    }
    async getStatus() {
        const store = await this.loadStore();
        return {
            enabled: this.running,
            jobs: store.jobs.length,
            next_wake_at_ms: this.getNextWakeMs(),
        };
    }
}
exports.CronService = CronService;
