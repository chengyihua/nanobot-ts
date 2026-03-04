"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageAggregator = void 0;
class MessageAggregator {
    constructor(onAggregate) {
        this.aggregators = new Map();
        this.onAggregateCallback = onAggregate;
    }
    add(sessionId, message) {
        let aggregator = this.aggregators.get(sessionId);
        if (aggregator) {
            clearTimeout(aggregator.timer);
            aggregator.messages.push(message);
        }
        else {
            aggregator = {
                messages: [message],
                timer: null
            };
            this.aggregators.set(sessionId, aggregator);
        }
        // 1.5s 聚合窗口结束后执行
        aggregator.timer = setTimeout(() => {
            this.processAggregation(sessionId);
        }, 1500);
    }
    processAggregation(sessionId) {
        const currentAggregator = this.aggregators.get(sessionId);
        if (!currentAggregator)
            return;
        this.aggregators.delete(sessionId);
        // 合并消息内容
        const combinedContent = currentAggregator.messages.map(m => m.content).join('\n\n');
        const firstMsg = currentAggregator.messages[0];
        const aggregatedMessage = {
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
exports.MessageAggregator = MessageAggregator;
