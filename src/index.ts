import { Command } from 'commander';
import readline from 'readline';
import path from 'path';
import fs from 'fs-extra';
import 'dotenv/config';
import { loadConfig, saveConfig, getCronStorePath, DEFAULT_CONFIG_PATH, ConfigSchema } from './core/config.js';
import { bus } from './core/bus.js';
import { AgentLoop } from './core/agent-loop.js';
import { CronService } from './cron/service.js';
import { WeComChannel } from './channels/wecom.js';
import { HeartbeatService } from './core/heartbeat.js';

const program = new Command();

program
  .name('nanobot')
  .description('Ultra-lightweight personal AI assistant in TypeScript')
  .version('0.1.0');

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

program
  .command('gateway')
  .description('Start the nanobot gateway (all services)')
  .option('-p, --port <number>', 'Gateway port', '8080')
  .action(async (options) => {
    const config = await loadConfig();
    const port = parseInt(options.port);

    console.log(`🌐 Starting nanobot gateway on port ${port}...`);

    // Initialize Cron Service
    const cronStorePath = getCronStorePath(config);
    const cron = new CronService(cronStorePath, async (job) => {
      console.log(`[Cron] Triggering job: ${job.name}`);
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
        },
      });
      return 'Message published to bus';
    });
    await cron.start();

    // Initialize Agent
    const agent = new AgentLoop(config, cron);
    await agent.start();

    // Initialize Channels
    if (config.channels.wecom.enabled) {
      const wecom = new WeComChannel(config);
      await wecom.start();
      console.log('✅ WeCom channel started');
    }

    // Initialize Heartbeat Service
    const heartbeat = new HeartbeatService(config);
    await heartbeat.start();

    console.log('🚀 Gateway is running. Press Ctrl+C to stop.');

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
  .action(async (options) => {
    const config = await loadConfig();
    
    // Initialize Cron Service if not disabled
    let cron;
    if (options.services) {
      const cronStorePath = getCronStorePath(config);
      cron = new CronService(cronStorePath, async (job) => {
        console.log(`[Cron] Triggering job: ${job.name}`);
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
      });
      await cron.start();
    }

    // Initialize Agent
    const agent = new AgentLoop(config, cron);
    await agent.start();

    if (options.services) {
      // Initialize Channels
      if (config.channels.wecom.enabled) {
        const wecom = new WeComChannel(config);
        await wecom.start();
        console.log('✅ WeCom channel started');
      }

      // Initialize Heartbeat Service
      const heartbeat = new HeartbeatService(config);
      await heartbeat.start();
    }

    if (options.message) {
      // Single message mode
      bus.onMessage((message) => {
        if (message.source === 'agent' && message.metadata?.sessionId === options.session) {
          console.log(`Nanobot > ${message.content}`);
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
        if (message.source === 'agent') {
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
      console.log(`  Message: ${job.payload.message}`);
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
