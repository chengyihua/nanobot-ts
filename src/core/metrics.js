"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMetrics = void 0;
// Shared in-memory counters for quick surfacing in /health.
// Not persistent and not concurrency-safe across processes, but adequate for single-node gateway.
exports.agentMetrics = {
    turns: 0,
    tool_calls: 0,
    tool_errors: 0,
    timeouts: 0,
};
