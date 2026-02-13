import { EventEmitter } from 'events';

export interface Message {
  id: string;
  source: string;
  target?: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: number;
  metadata?: Record<string, any>;
}

export class MessageBus extends EventEmitter {
  private static instance: MessageBus;
  private inboundQueue: Message[] = [];
  private processingInbound = false;
  private outboundQueue: Message[] = [];
  private processingOutbound = false;

  private constructor() {
    super();
    // Increase limit for many subscribers
    this.setMaxListeners(100);
  }

  public static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  /**
   * Publish a message to the bus (inbound or outbound)
   */
  public publish(message: Message): void {
    if (message.source === 'agent') {
      this.publishOutbound(message);
    } else {
      this.publishInbound(message);
    }
  }

  /**
   * Publish a message from a channel to the agent
   */
  private publishInbound(message: Message): void {
    console.debug(`[Bus] Queueing inbound message from ${message.source}`);
    this.inboundQueue.push(message);
    this.processQueue('inbound');
  }

  /**
   * Publish a response from the agent to channels
   */
  private publishOutbound(message: Message): void {
    console.debug(`[Bus] Queueing outbound message for ${message.target || 'all'}`);
    this.outboundQueue.push(message);
    this.processQueue('outbound');
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
        if (message) {
          console.debug(`[Bus] Dispatching ${type} message: ${message.content.substring(0, 50)}...`);
          
          try {
            this.emit('message', message);
            if (message.target) {
              this.emit(`message:${message.target}`, message);
            }
          } catch (error) {
            console.error(`[Bus] Error processing message ${message.id}:`, error);
          }
          
          // Give a small breath to the event loop
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    } finally {
      if (type === 'inbound') this.processingInbound = false;
      else this.processingOutbound = false;
    }
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

  public get inboundSize(): number {
    return this.inboundQueue.length;
  }

  public get outboundSize(): number {
    return this.outboundQueue.length;
  }
}

export const bus = MessageBus.getInstance();
