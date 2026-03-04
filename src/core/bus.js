"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bus = exports.MessageBus = exports.MemoryTransportAdapter = void 0;
const events_1 = require("events");
class MemoryTransportAdapter {
    constructor() {
        this.inboundQueue = [];
        this.outboundQueue = [];
        this.processingInbound = false;
        this.processingOutbound = false;
    }
    async connect() {
        // No-op for memory
    }
    async disconnect() {
        // No-op for memory
    }
    subscribe(handler) {
        this.handler = handler;
    }
    async publish(message) {
        if (message.source === 'agent') {
            console.debug(`[Bus] Queueing outbound message for ${message.target || 'all'}`);
            this.outboundQueue.push(message);
            this.processQueue('outbound');
        }
        else {
            console.debug(`[Bus] Queueing inbound message from ${message.source}`);
            this.inboundQueue.push(message);
            this.processQueue('inbound');
        }
    }
    async processQueue(type) {
        const isProcessing = type === 'inbound' ? this.processingInbound : this.processingOutbound;
        const queue = type === 'inbound' ? this.inboundQueue : this.outboundQueue;
        if (isProcessing)
            return;
        if (type === 'inbound')
            this.processingInbound = true;
        else
            this.processingOutbound = true;
        try {
            while (queue.length > 0) {
                const message = queue.shift();
                if (message && this.handler) {
                    console.debug(`[Bus] Dispatching ${type} message: ${message.content.substring(0, 50)}...`);
                    try {
                        this.handler(message);
                    }
                    catch (error) {
                        console.error(`[Bus] Error processing message ${message.id}:`, error);
                    }
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
        }
        finally {
            if (type === 'inbound')
                this.processingInbound = false;
            else
                this.processingOutbound = false;
        }
    }
}
exports.MemoryTransportAdapter = MemoryTransportAdapter;
class MessageBus extends events_1.EventEmitter {
    constructor() {
        super();
        // Increase limit for many subscribers
        this.setMaxListeners(100);
        this.adapter = new MemoryTransportAdapter();
        this.setupAdapter();
    }
    setupAdapter() {
        this.adapter.subscribe((message) => {
            this.emit('message', message);
            if (message.target) {
                this.emit(`message:${message.target}`, message);
            }
        });
    }
    static getInstance() {
        if (!MessageBus.instance) {
            MessageBus.instance = new MessageBus();
        }
        return MessageBus.instance;
    }
    async setAdapter(adapter) {
        await this.adapter.disconnect();
        this.adapter = adapter;
        this.setupAdapter();
        await this.adapter.connect();
    }
    /**
     * Publish a message to the bus (inbound or outbound)
     */
    async publish(message) {
        await this.adapter.publish(message);
    }
    /**
     * Subscribe to all messages
     */
    onMessage(handler) {
        this.on('message', handler);
    }
    /**
     * Subscribe to messages targeted at a specific agent/channel
     */
    onTargetedMessage(target, handler) {
        this.on(`message:${target}`, handler);
    }
}
exports.MessageBus = MessageBus;
exports.bus = MessageBus.getInstance();
