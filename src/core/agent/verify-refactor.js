"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_loop_js_1 = require("../agent-loop.js");
const tool_registry_js_1 = require("../tool-registry.js");
const session_manager_js_1 = require("../session-manager.js");
// Mock Config
const mockConfig = {
    get: (key) => {
        if (key === 'agent.history_user_limit')
            return 10;
        if (key === 'agent.tool_concurrency')
            return 3;
        if (key === 'agent.safety_guard_enabled')
            return false;
        return undefined;
    },
    set: () => { },
    has: () => true
};
// Mock Dependencies
const mockToolRegistry = new tool_registry_js_1.ToolRegistry(mockConfig);
const mockSessionManager = new session_manager_js_1.SessionManager();
console.log('Instantiating AgentLoop...');
try {
    const agentLoop = new agent_loop_js_1.AgentLoop(mockConfig, undefined, mockSessionManager, mockToolRegistry);
    console.log('AgentLoop instantiated successfully.');
    if (agentLoop['contextManager']) {
        console.log('ContextManager is initialized.');
    }
    else {
        console.error('ContextManager is MISSING!');
        process.exit(1);
    }
    if (agentLoop['stepExecutor']) {
        console.log('StepExecutor is initialized.');
    }
    else {
        console.error('StepExecutor is MISSING!');
        process.exit(1);
    }
    console.log('Verification PASSED.');
}
catch (error) {
    console.error('Verification FAILED:', error);
    process.exit(1);
}
