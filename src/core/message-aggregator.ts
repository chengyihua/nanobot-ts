import { Message } from './bus.js';

type Aggregator = {
  timer: NodeJS.Timeout;
  messages: Message[];
};

export class MessageAggregator {
  private aggregators: Map<string, Aggregator> = new Map();
  private onAggregateCallback: (sessionId: string, aggregatedMessage: Message) => void;

  constructor(onAggregate: (sessionId: string, aggregatedMessage: Message) => void) {
    this.onAggregateCallback = onAggregate;
  }

  public add(sessionId: string, message: Message) {
    let aggregator = this.aggregators.get(sessionId);
    
    if (aggregator) {
      clearTimeout(aggregator.timer);
      aggregator.messages.push(message);
    } else {
      aggregator = {
        messages: [message],
        timer: null as any
      };
      this.aggregators.set(sessionId, aggregator);
    }

    // 1.5s 聚合窗口结束后执行
    aggregator.timer = setTimeout(() => {
      this.processAggregation(sessionId);
    }, 1500);
  }

  private processAggregation(sessionId: string) {
    const currentAggregator = this.aggregators.get(sessionId);
    if (!currentAggregator) return;
    
    this.aggregators.delete(sessionId);

    // 合并消息内容
    const combinedContent = currentAggregator.messages.map(m => m.content).join('\n\n');
    const firstMsg = currentAggregator.messages[0];
    
    const aggregatedMessage: Message = {
      ...firstMsg,
      content: combinedContent,
      metadata: {
        ...firstMsg.metadata,
        aggregatedCount: currentAggregator.messages.length
      }
    };

    this.onAggregateCallback(sessionId, aggregatedMessage);
  }
}
