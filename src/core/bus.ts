import { EventEmitter } from 'events';
import type { Message, TransportAdapter } from './bus-types.js';

export type { Message, TransportAdapter };

export class MemoryTransportAdapter implements TransportAdapter {
  private inboundQueue: Message[] = [];
  private outboundQueue: Message[] = [];
  private processingInbound = false;
  private processingOutbound = false;
  private handler?: (message: Message) => void;

  public async connect(): Promise<void> {
    // No-op for memory
  }

  public async disconnect(): Promise<void> {
    // No-op for memory
  }

  public subscribe(handler: (message: Message) => void): void {
    this.handler = handler;
  }

  public async publish(message: Message): Promise<void> {
    if (message.source === 'agent') {
      console.debug(`[Bus] Queueing outbound message for ${message.target || 'all'}`);
      this.outboundQueue.push(message);
      this.processQueue('outbound');
    } else {
      console.debug(`[Bus] Queueing inbound message from ${message.source}`);
      this.inboundQueue.push(message);
      this.processQueue('inbound');
    }
  }

  private async processQueue(type: 'inbound' | 'outbound'): Promise<void> {
    const isProcessing = type === 'inbound' ? this.processingInbound : this.processingOutbound;
    const queue = type === 'inbound' ? this.inboundQueue : this.outboundQueue;

    if (isProcessing) return;

    if (type === 'inbound') this.processingInbound = true;
    else this.processingOutbound = true;

    try {
      while (queue.length > 0) {
        const message = queue.shift();
        if (message && this.handler) {
          console.debug(`[Bus] Dispatching ${type} message: ${message.content.substring(0, 50)}...`);
          try {
             this.handler(message);
          } catch (error) {
             console.error(`[Bus] Error processing message ${message.id}:`, error);
          }
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    } finally {
      if (type === 'inbound') this.processingInbound = false;
      else this.processingOutbound = false;
    }
  }
}

export class MessageBus extends EventEmitter {
  private static instance: MessageBus;
  private adapter: TransportAdapter;

  private constructor() {
    super();
    // Increase limit for many subscribers
    this.setMaxListeners(100);
    this.adapter = new MemoryTransportAdapter();
    this.setupAdapter();
  }

  private setupAdapter() {
    this.adapter.subscribe((message) => {
      this.emit('message', message);
      if (message.target) {
        this.emit(`message:${message.target}`, message);
      }
    });
  }

  public static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  public async setAdapter(adapter: TransportAdapter) {
    await this.adapter.disconnect();
    this.adapter = adapter;
    this.setupAdapter();
    await this.adapter.connect();
  }

  /**
   * Publish a message to the bus (inbound or outbound)
   */
  public async publish(message: Message): Promise<void> {
    await this.adapter.publish(message);
  }

  /**
   * Subscribe to all messages
   */
  public onMessage(handler: (message: Message) => void): void {
    this.on('message', handler);
  }

  /**
   * Subscribe to messages targeted at a specific agent/channel
   */
  public onTargetedMessage(target: string, handler: (message: Message) => void): void {
    this.on(`message:${target}`, handler);
  }
}

export const bus = MessageBus.getInstance();
