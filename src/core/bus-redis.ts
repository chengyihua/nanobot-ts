import { Redis, RedisOptions } from 'ioredis';
import { Config } from './config.js';
import type { TransportAdapter, Message } from './bus-types.js';

export class RedisTransportAdapter implements TransportAdapter {
  private pubClient: Redis;
  private subClient: Redis;
  private channelName: string = 'nanobot:bus';
  private handler?: (message: Message) => void;
  private connected = false;

  constructor(config: Config) {
    const redisConfig = config.redis || {};
    const options: RedisOptions = {
      host: redisConfig.host || 'localhost',
      port: redisConfig.port || 6379,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    };

    this.pubClient = new Redis(options);
    this.subClient = new Redis(options);
    
    // Handle errors to prevent crash
    this.pubClient.on('error', (err) => console.error('[RedisBus] PubClient Error:', err.message));
    this.subClient.on('error', (err) => console.error('[RedisBus] SubClient Error:', err.message));
  }

  public async connect(): Promise<void> {
    if (this.connected) return;

    // Wait for connection
    await Promise.all([
      new Promise<void>((resolve) => {
        if (this.pubClient.status === 'ready') resolve();
        else this.pubClient.once('ready', () => resolve());
      }),
      new Promise<void>((resolve) => {
        if (this.subClient.status === 'ready') resolve();
        else this.subClient.once('ready', () => resolve());
      })
    ]);

    // Subscribe to channel
    await this.subClient.subscribe(this.channelName);
    
    this.subClient.on('message', (channel, messageStr) => {
      if (channel === this.channelName && this.handler) {
        try {
          const message = JSON.parse(messageStr);
          this.handler(message);
        } catch (error) {
          console.error('[RedisBus] Failed to parse message:', error);
        }
      }
    });

    this.connected = true;
    console.log('[RedisBus] Connected to Redis');
  }

  public async disconnect(): Promise<void> {
    await this.pubClient.quit();
    await this.subClient.quit();
    this.connected = false;
  }

  public subscribe(handler: (message: Message) => void): void {
    this.handler = handler;
  }

  public async publish(message: Message): Promise<void> {
    await this.pubClient.publish(this.channelName, JSON.stringify(message));
  }
}
