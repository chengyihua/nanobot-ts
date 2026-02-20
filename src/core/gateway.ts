
import express from 'express';
import { Config, getCronStorePath } from './config.js';
import { CronService } from '../cron/service.js';
import { createLogger } from '../utils/logger.js';
import { agentMetrics } from './metrics.js';
import { housekeepingStats } from '../utils/cleanup.js';

export class Gateway {
  private app: express.Express;
  private config: Config;
  private server: any;
  private log = createLogger('gateway');
  private metrics = agentMetrics;

  constructor(config: Config) {
    this.config = config;
    this.app = express();

    // Debug Middleware - Catch all requests immediately
    this.app.use((req, res, next) => {
        console.log('GATEWAY DEBUG: Incoming request', req.method, req.url, req.ip);
        next();
    });

    // Basic Middleware
    this.app.use(express.json({
        verify: (req: any, res, buf) => {
          req.rawBody = buf;
        }
    }));
    this.app.use(express.text({ type: ['*/xml', 'text/xml', 'application/xml'] }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
        if (req.path !== '/health') {
            this.log.debug({ method: req.method, path: req.path, ip: req.ip }, 'gateway request');
        }
        next();
    });

    // Health endpoint (no secrets)
    this.app.get('/health', async (_req, res) => {
      const cronStorePath = getCronStorePath(this.config);
      const cron = new CronService(cronStorePath);
      const cronStatus = await cron.getStatus();

      const heartbeatEnabled = this.config.heartbeat?.enabled ?? true;
      const toolsRestrict = this.config.tools?.restrict_to_workspace ?? false;
      const housekeeping = {
        uploads_retention_days: this.config.housekeeping?.uploads_retention_days,
        sessions_retention_days: this.config.housekeeping?.sessions_retention_days,
      };
      const rateLimits = {
        runcommand: this.config.tools.exec?.rate_limits,
        webfetch: this.config.tools.web?.rate_limits,
      };

      res.json({
        status: 'ok',
        gateway: this.config.gateway,
        cron: cronStatus,
        heartbeat: { enabled: heartbeatEnabled, interval_seconds: this.config.heartbeat?.interval_seconds },
        tools: { restrict_to_workspace: toolsRestrict },
        channels: Object.fromEntries(Object.entries(this.config.channels).map(([k, v]: [string, any]) => [k, v.enabled])),
        metrics: this.metrics,
        housekeeping,
        rate_limits: rateLimits,
        housekeeping_stats: housekeepingStats,
      });
    });

    // Simple Prometheus-style metrics (no labels) for quick scrape
    this.app.get('/metrics', (_req, res) => {
      const lines = [
        '# HELP nanobot_turns_total Total turns handled by agent',
        '# TYPE nanobot_turns_total counter',
        `nanobot_turns_total ${this.metrics.turns}`,
        '# HELP nanobot_tool_calls_total Total tool calls executed',
        '# TYPE nanobot_tool_calls_total counter',
        `nanobot_tool_calls_total ${this.metrics.tool_calls}`,
        '# HELP nanobot_tool_errors_total Total tool errors',
        '# TYPE nanobot_tool_errors_total counter',
        `nanobot_tool_errors_total ${this.metrics.tool_errors}`,
        '# HELP nanobot_timeouts_total Total timeouts (LLM/tool)',
        '# TYPE nanobot_timeouts_total counter',
        `nanobot_timeouts_total ${this.metrics.timeouts}`,
        '# HELP nanobot_housekeeping_uploads_last_removed Last uploads removed count in a cleanup run',
        '# TYPE nanobot_housekeeping_uploads_last_removed gauge',
        `nanobot_housekeeping_uploads_last_removed ${housekeepingStats.uploads.lastRemoved ?? 0}`,
        '# HELP nanobot_housekeeping_uploads_last_run_seconds Epoch seconds of last uploads cleanup',
        '# TYPE nanobot_housekeeping_uploads_last_run_seconds gauge',
        `nanobot_housekeeping_uploads_last_run_seconds ${(housekeepingStats.uploads.lastRun ?? 0) / 1000}`,
        '# HELP nanobot_housekeeping_sessions_last_removed Last sessions removed count in a cleanup run',
        '# TYPE nanobot_housekeeping_sessions_last_removed gauge',
        `nanobot_housekeeping_sessions_last_removed ${housekeepingStats.sessions.lastRemoved ?? 0}`,
        '# HELP nanobot_housekeeping_sessions_last_run_seconds Epoch seconds of last sessions cleanup',
        '# TYPE nanobot_housekeeping_sessions_last_run_seconds gauge',
        `nanobot_housekeeping_sessions_last_run_seconds ${(housekeepingStats.sessions.lastRun ?? 0) / 1000}`,
        '# HELP nanobot_rate_limit_runcommand_triggers Total rate-limit hits for runCommand',
        '# TYPE nanobot_rate_limit_runcommand_triggers counter',
        `nanobot_rate_limit_runcommand_triggers ${housekeepingStats.rate_limits.runcommand_triggers}`,
        '# HELP nanobot_rate_limit_webfetch_triggers Total rate-limit hits for webFetch',
        '# TYPE nanobot_rate_limit_webfetch_triggers counter',
        `nanobot_rate_limit_webfetch_triggers ${housekeepingStats.rate_limits.webfetch_triggers}`,
        '# HELP nanobot_rate_limit_runcommand_remaining Current remaining quota in window for runCommand',
        '# TYPE nanobot_rate_limit_runcommand_remaining gauge',
        `nanobot_rate_limit_runcommand_remaining ${housekeepingStats.rate_limits.runcommand_remaining ?? 0}`,
        '# HELP nanobot_rate_limit_webfetch_remaining Current remaining quota in window for webFetch',
        '# TYPE nanobot_rate_limit_webfetch_remaining gauge',
        `nanobot_rate_limit_webfetch_remaining ${housekeepingStats.rate_limits.webfetch_remaining ?? 0}`,
      ];
      res.set('Content-Type', 'text/plain; charset=utf-8').send(lines.join('\n'));
    });
  }

  public getApp() {
    return this.app;
  }

  public async start() {
    const port = this.config.gateway?.port || 8080;
    const host = this.config.gateway?.host || '0.0.0.0';

    return new Promise<void>((resolve) => {
      this.server = this.app.listen(port, host, () => {
            console.log(`🌐 Central Gateway running on http://${host}:${port}`);
            resolve();
        });
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
    }
  }
}
