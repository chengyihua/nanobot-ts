
export interface Message {
  id: string;
  source: string;
  target?: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TransportAdapter {
  publish(message: Message): Promise<void>;
  subscribe(handler: (message: Message) => void): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
