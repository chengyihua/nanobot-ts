
import express from 'express';
import { Config, getCronStorePath } from './config.js';
import { CronService } from '../cron/service.js';
import { HeartbeatService } from './heartbeat.js';
import { createLogger } from '../utils/logger.js';

export class Gateway {
  private app: express.Express;
  private config: Config;
  private server: any;
  private log = createLogger('gateway');

  constructor(config: Config) {
    this.config = config;
    this.app = express();
    
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

      res.json({
        status: 'ok',
        gateway: this.config.gateway,
        cron: cronStatus,
        heartbeat: { enabled: heartbeatEnabled, interval_seconds: this.config.heartbeat?.interval_seconds },
        tools: { restrict_to_workspace: toolsRestrict },
        channels: Object.fromEntries(Object.entries(this.config.channels).map(([k, v]: [string, any]) => [k, v.enabled])),
      });
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
