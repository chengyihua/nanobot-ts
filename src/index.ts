import { Command } from 'commander';
import readline from 'readline';
import path from 'path';
import fs from 'fs-extra';
import 'dotenv/config';
import { loadConfig, saveConfig, getCronStorePath, DEFAULT_CONFIG_PATH, ConfigSchema } from './core/config.js';
import { bus } from './core/bus.js';
import { AgentLoop } from './core/agent-loop.js';
import { ToolRegistry } from './core/tool-registry.js';
import { MCPClientManager } from './core/mcp/client-manager.js';
import { SummaryService } from './core/summary/service.js';
import { CronService } from './cron/service.js';
import { WeComChannel } from './channels/wecom.js';
import { QQChannel } from './channels/qq.js';
import { QQOfficialChannel } from './channels/qq-official.js';
import { WeChatiPadChannel } from './channels/wechat-ipad.js';
import { HeartbeatService } from './core/heartbeat.js';
import { createLogger } from './utils/logger.js';
import { registerSessionsCommand } from './commands/sessions.js';
import { runStartupChecks } from './utils/startup-check.js';
import { RedisTransportAdapter } from './core/bus-redis.js';

const rootLog = createLogger('cli');

const program = new Command();

program
  .name('nanobot')
  .description('Ultra-lightweight personal AI assistant in TypeScript')
  .version('0.1.0');

// Register subcommands
registerSessionsCommand(program);

program
  .command('onboard')
  .description('Initialize nanobot configuration and workspace')
  .action(async () => {
    console.log('🚀 Onboarding nanobot...');
    
    if (await fs.pathExists(DEFAULT_CONFIG_PATH)) {
      console.log(`✨ Config already exists at ${DEFAULT_CONFIG_PATH}`);
    } else {
      const defaultConfig = ConfigSchema.parse({});
      await saveConfig(defaultConfig);
      console.log(`📝 Created default config at ${DEFAULT_CONFIG_PATH}`);
    }

    const config = await loadConfig();
    const workspacePath = path.resolve(config.agents.defaults.workspace);
    await fs.ensureDir(workspacePath);
    console.log(`📁 Workspace ready at ${workspacePath}`);

    const memoryPath = path.join(path.dirname(workspacePath), 'memory');
    await fs.ensureDir(memoryPath);
    console.log(`🧠 Memory directory ready at ${memoryPath}`);

    console.log('\n✅ Onboarding complete! You can now run "nanobot agent" or "nanobot gateway".');
  });

import { Gateway } from './core/gateway.js';

program
  .command('gateway')
  .description('Start the nanobot gateway (all services)')
  .option('-p, --port <number>', 'Gateway port', '8080')
  .option('--no-agent', 'Run gateway only (no agent loop)')
  .option('--redis', 'Use Redis message bus')
  .action(async (options) => {
    const config = await loadConfig();
    const port = parseInt(options.port);
    
    // Override gateway port if provided
    if (!config.gateway) config.gateway = { port: 8080, host: '0.0.0.0' };
    config.gateway.port = port;

    if (options.redis || config.redis?.enabled) {
      const redisAdapter = new RedisTransportAdapter(config);
      await bus.setAdapter(redisAdapter);
      console.log('🔗 Connected to Redis Message Bus');
    }

    rootLog.info({ port }, 'Starting nanobot gateway');

    const startupNotes = await runStartupChecks();
    startupNotes.forEach(note => rootLog.warn(note));

    // Initialize Gateway Server
    const gateway = new Gateway(config);
    const app = gateway.getApp();

    // Debug: optional request log (headers redacted)
    app.use((req, _res, next) => {
      rootLog.debug({ method: req.method, url: req.url, ip: req.ip }, 'gateway request');
      next();
    });

    // Initialize Summary Service
    const summaryService = new SummaryService(config);

    // Initialize Cron Service
    const cronStorePath = getCronStorePath(config);
    const cron = new CronService(cronStorePath, async (job) => {
      rootLog.info({ job: job.id, name: job.name, kind: job.payload.kind }, 'Cron triggered');

      if (job.payload.kind === 'system_task') {
        if (job.payload.task === 'generate_hourly_summary') {
          await summaryService.generateHourlySummary();
          return 'Hourly summary generated';
        }
        if (job.payload.task === 'generate_daily_summary') {
          await summaryService.generateDailySummary();
          return 'Daily summary generated';
        }
        return `Unknown system task: ${job.payload.task}`;
      }

      if (job.payload.kind === 'agent_turn') {
        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'cron',
          target: job.payload.channel, // Explicitly target the channel
          content: job.payload.message,
          type: 'text',
          timestamp: Date.now(),
          metadata: { 
            sessionId: job.id,
            jobId: job.id,
            deliver: job.payload.deliver,
            channel: job.payload.channel,
            to: job.payload.to,
          },
        });
        return 'Message published to bus';
      }
      return null;
    });

    // Register default summary jobs
    try {
      await cron.addJob({
        name: 'Hourly Summary',
        schedule: { kind: 'cron', expr: '0 * * * *' }, // Every hour at :00
        kind: 'system_task',
        task: 'generate_hourly_summary',
        delete_after_run: false
      });

      await cron.addJob({
        name: 'Daily Summary',
        schedule: { kind: 'cron', expr: '0 0 * * *' }, // Every day at 00:00
        kind: 'system_task',
        task: 'generate_daily_summary',
        delete_after_run: false
      });
    } catch (err) {
      rootLog.warn({ err }, 'Failed to register default summary jobs');
    }

    // Listen for updates from agent
    bus.onMessage((message) => {
      if (message.metadata?.type === 'cron_update') {
        rootLog.info('Received cron update notification, reloading...');
        cron.reload();
      }
    });

    await cron.start();

    // Initialize MCP Manager
    const mcpManager = new MCPClientManager(config);
    await mcpManager.initialize();

    // Initialize Tool Registry
    const toolRegistry = new ToolRegistry(config, mcpManager);

    // Initialize Agent
    if (options.agent) {
      const agent = new AgentLoop(config, cron, undefined, toolRegistry);
      await agent.start();
      console.log('🤖 Agent loop started (Embedded)');
    } else {
      console.log('🚫 Agent loop disabled (Gateway only mode)');
    }

    if (config.channels.qq_official?.enabled) {
      const qqOfficial = new QQOfficialChannel(config);
      // Pass the shared gateway app to QQ Official Channel
      await qqOfficial.start(app);
      console.log('✅ QQ Official channel started');
    }

    // Initialize Channels
    if (config.channels.wecom.enabled) {
      const wecom = new WeComChannel(config);
      await wecom.start(app);
      rootLog.info('WeCom channel started (Attached to Gateway)');
    }

    if (config.channels.wechat_ipad.enabled) {
      const wechatIpad = new WeChatiPadChannel(config);
      await wechatIpad.start();
      console.log('✅ WeChat iPad channel started');
    }

    if (config.channels.qq.enabled) {
      const qq = new QQChannel(config);
      await qq.start();
      console.log('✅ QQ channel started');
    }

    // Start the Gateway Server
    await gateway.start();


    // Initialize Heartbeat Service
    const heartbeat = new HeartbeatService(config);
    await heartbeat.start();

    rootLog.info('Gateway is running. Press Ctrl+C to stop.');

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down...');
      process.exit(0);
    });
  });

program
  .command('agent')
  .description('Interact with the agent directly (starts all enabled services)')
  .option('-s, --session <id>', 'Session ID', 'default')
  .option('-m, --message <text>', 'Single message to send')
  .option('--no-services', 'Run agent only without other services (channels, cron, etc.)')
  .option('--daemon', 'Run as background worker (no CLI interaction)')
  .option('--redis', 'Use Redis message bus')
  .action(async (options) => {
    const config = await loadConfig();
    
    if (options.redis) {
      const redisAdapter = new RedisTransportAdapter(config);
      await bus.setAdapter(redisAdapter);
      console.log('🔗 Connected to Redis Message Bus');
    }

    // Initialize Cron Service (always needed for tools)
    const cronStorePath = getCronStorePath(config);
    const onCronUpdate = () => {
      // Notify other processes (Gateway) about cron updates
      if (options.redis || options.daemon) {
        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'agent',
          target: 'gateway',
          content: 'Cron store updated',
          type: 'text',
          timestamp: Date.now(),
          metadata: { type: 'cron_update' }
        });
      }
    };

    const cron = new CronService(cronStorePath, async (job) => {
      console.log(`[Cron] Triggering job: ${job.name}`);

      if (job.payload.kind === 'system_task') {
        const summaryService = new SummaryService(config);
        if (job.payload.task === 'generate_hourly_summary') {
          await summaryService.generateHourlySummary();
          return 'Hourly summary generated';
        }
        if (job.payload.task === 'generate_daily_summary') {
          await summaryService.generateDailySummary();
          return 'Daily summary generated';
        }
        return `Unknown system task: ${job.payload.task}`;
      }

      if (job.payload.kind === 'agent_turn') {
        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'cron',
          content: job.payload.message,
          type: 'text',
          timestamp: Date.now(),
          metadata: { 
            sessionId: job.id,
            jobId: job.id,
            deliver: job.payload.deliver,
            channel: job.payload.channel,
            to: job.payload.to,
            // 确保 Agent 知道这是从哪个渠道触发的定时任务
            originChannel: job.payload.channel,
            originChatId: job.payload.to,
          },
        });
        return 'Message published to bus';
      }
      return null;
    }, onCronUpdate);

    // Only start cron execution if we are NOT in daemon mode and NOT disabling services
    if (options.services && !options.daemon) {
      await cron.start();
    }

    // Initialize MCP Manager
    const mcpManager = new MCPClientManager(config);
    await mcpManager.initialize();

    // Initialize Tool Registry
    const toolRegistry = new ToolRegistry(config, mcpManager);

    // Initialize Agent
    const agent = new AgentLoop(config, cron, undefined, toolRegistry);
    await agent.start();

    if (options.daemon) {
      console.log('🤖 Agent Worker started (Daemon mode)');
      console.log('Listening for messages on bus...');
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\n👋 Shutting down agent worker...');
        // agent.stop(); // If AgentLoop has stop method
        process.exit(0);
      });
      
      // Prevent function from exiting
      return new Promise(() => {}); 
    }

    if (options.services) {
      // Initialize Channels
      if (config.channels?.wecom?.enabled) {
        const wecom = new WeComChannel(config);
        await wecom.start();
        console.log('✅ WeCom channel started');
      }

      if (config.channels?.qq?.enabled) {
        const qq = new QQChannel(config);
        await qq.start();
        console.log('✅ QQ channel started');
      }

      if (config.channels?.qq_official?.enabled) {
        const qqOfficial = new QQOfficialChannel(config);
        await qqOfficial.start();
        console.log('✅ QQ Official channel started');
      }

      // Initialize Heartbeat Service
      const heartbeat = new HeartbeatService(config);
      await heartbeat.start();
    }

    if (options.message) {
      // Single message mode
      bus.onMessage((message) => {
        if ((message.source === 'agent' || message.source === 'subagent') && message.metadata?.sessionId === options.session) {
          if (message.metadata?.stream) {
            process.stdout.write(message.content);
            return;
          }
          console.log(`\nNanobot > ${message.content}`);
          // If we are running services, we might not want to exit immediately
          if (!options.services) process.exit(0);
        }
      });

      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'cli',
        content: options.message,
        type: 'text',
        timestamp: Date.now(),
        metadata: { sessionId: options.session },
      });

      // If running services, keep alive
      if (options.services) {
        console.log('🚀 Services are running in background. Press Ctrl+C to stop.');
      }
    } else {
      // Interactive mode
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'You > ',
      });

      bus.onMessage((message) => {
        if (message.source === 'agent' || message.source === 'subagent') {
          if (message.metadata?.stream) {
            process.stdout.write(message.content);
            return;
          }
          const isCron = message.metadata?.jobId !== undefined;
          const prefix = isCron ? `[Cron Response: ${message.metadata?.jobId}] ` : '';
          console.log(`\n${prefix}Nanobot > ${message.content}`);
          rl.prompt();
        }
      });

      if (options.services) {
        console.log('🚀 Services started (WeCom, Cron, etc.)');
      }
      console.log('--- Interactive Mode (Type "exit" to quit) ---');
      rl.prompt();

      rl.on('line', (line) => {
        const input = line.trim();
        if (input.toLowerCase() === 'exit') {
          process.exit(0);
        }

        if (input) {
          bus.publish({
            id: Math.random().toString(36).substring(7),
            source: 'cli',
            content: input,
            type: 'text',
            timestamp: Date.now(),
            metadata: { sessionId: options.session },
          });
        } else {
          rl.prompt();
        }
      }).on('close', () => {
        process.exit(0);
      });
    }
  });

program
  .command('status')
  .description('Show nanobot status')
  .action(async () => {
    const config = await loadConfig();
    console.log('📊 Nanobot Status:');
    console.log(`- Config Path: ${DEFAULT_CONFIG_PATH}`);
    console.log(`- Workspace: ${config.agents.defaults.workspace}`);
    console.log(`- Default Model: ${config.agents.defaults.model}`);
    
    console.log('\n📡 Channels:');
    Object.entries(config.channels).forEach(([name, channelConfig]: [string, any]) => {
      console.log(`- ${name}: ${channelConfig.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    });

    const cronStorePath = getCronStorePath(config);
    const cron = new CronService(cronStorePath);
    const cronStatus = await cron.getStatus();
    console.log('\n⏰ Cron Service:');
    console.log(`- Jobs: ${cronStatus.jobs}`);
    if (cronStatus.next_wake_at_ms) {
      console.log(`- Next Wake: ${new Date(cronStatus.next_wake_at_ms).toLocaleString()}`);
    }
  });

const cronCmd = program.command('cron').description('Manage scheduled tasks');

cronCmd
  .command('list')
  .description('List all cron jobs')
  .option('-a, --all', 'Include disabled jobs')
  .action(async (options) => {
    const config = await loadConfig();
    const cronStorePath = getCronStorePath(config);
    const cron = new CronService(cronStorePath);
    const jobs = await cron.listJobs(options.all);
    
    if (jobs.length === 0) {
      console.log('No cron jobs found.');
      return;
    }

    console.log('⏰ Cron Jobs:');
    jobs.forEach(job => {
      const nextRun = job.state.next_run_at_ms ? new Date(job.state.next_run_at_ms).toLocaleString() : 'N/A';
      console.log(`- [${job.id}] ${job.name} (Next: ${nextRun})`);
      if (job.payload.kind === 'system_task') {
        console.log(`  Task: ${job.payload.task}`);
      } else {
        console.log(`  Message: ${job.payload.message}`);
      }
    });
  });

cronCmd
  .command('remove <id>')
  .description('Remove a cron job')
  .action(async (id) => {
    const config = await loadConfig();
    const cronStorePath = getCronStorePath(config);
    const cron = new CronService(cronStorePath);
    const removed = await cron.removeJob(id);
    if (removed) {
      console.log(`✅ Removed job ${id}`);
    } else {
      console.log(`❌ Job ${id} not found`);
    }
  });

const channelsCmd = program.command('channels').description('Manage communication channels');

channelsCmd
  .command('list')
  .description('List all communication channels')
  .action(async () => {
    const config = await loadConfig();
    console.log('📡 Communication Channels:');
    Object.entries(config.channels).forEach(([name, channelConfig]: [string, any]) => {
      console.log(`- ${name}: ${channelConfig.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    });
  });

program.parse(process.argv);
