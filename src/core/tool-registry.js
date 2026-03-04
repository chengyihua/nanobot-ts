"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const config_js_1 = require("./config.js");
const plugin_loader_js_1 = require("./plugin-loader.js");
const registry_js_1 = require("../providers/registry.js");
const fs_js_1 = require("../tools/definitions/fs.js");
const communication_js_1 = require("../tools/definitions/communication.js");
const vision_js_1 = require("../tools/definitions/vision.js");
const system_js_1 = require("../tools/definitions/system.js");
const web_js_1 = require("../tools/definitions/web.js");
const agent_js_1 = require("../tools/definitions/agent.js");
const memory_js_1 = require("../tools/definitions/memory.js");
const logger_js_1 = require("../utils/logger.js");
const cleanup_js_1 = require("../utils/cleanup.js");
class ToolRegistry {
    constructor(config) {
        this.log = (0, logger_js_1.createLogger)('tool-registry');
        this.pluginTools = {};
        this.cleanupRegistered = false;
        this.config = config;
        this.setupCleanup();
    }
    setupCleanup() {
        if (this.cleanupRegistered)
            return;
        this.cleanupRegistered = true;
        // Note: We don't register SIGINT/SIGTERM here directly to avoid conflicts if multiple registries exist
        // or if the main app handles it. But for safety, we can add a method to call manually.
    }
    async close() {
        // No-op for now as MCP client cleanup is removed
    }
    async initialize() {
        // Load Plugins
        await this.loadPlugins();
    }
    async loadPlugins() {
        const workspacePath = (0, config_js_1.getWorkspacePath)(this.config);
        if (workspacePath) {
            try {
                const loader = new plugin_loader_js_1.PluginLoader(workspacePath);
                this.pluginTools = await loader.loadPlugins({ config: this.config });
            }
            catch (e) {
                this.log.warn({ err: e }, 'Failed to load plugins');
            }
        }
    }
    getTools(contextOptions = {}) {
        // Merge provided options with config
        const options = { ...contextOptions, config: this.config };
        // Helpers
        const restrictToWorkspace = this.config.tools?.restrict_to_workspace ?? false;
        const workspacePath = (0, config_js_1.getWorkspacePath)(this.config);
        const checkPath = (filePath) => {
            let resolvedPath = filePath;
            if (filePath.startsWith('~')) {
                resolvedPath = path_1.default.join(os_1.default.homedir(), filePath.slice(1));
            }
            resolvedPath = path_1.default.resolve(resolvedPath);
            if (restrictToWorkspace) {
                if (!resolvedPath.startsWith(workspacePath)) {
                    const errorMsg = `Access denied by CONFIG: Path ${filePath} is outside the workspace ${workspacePath}. To fix this, set NANOBOT__TOOLS__RESTRICT_TO_WORKSPACE=false in your .env file.`;
                    console.error(`[checkPath] ${errorMsg}`);
                    throw new Error(errorMsg);
                }
            }
            else {
                console.log(`[checkPath] FULL ACCESS MODE: ${resolvedPath}`);
            }
            try {
                fs_extra_1.default.accessSync(path_1.default.dirname(resolvedPath), fs_extra_1.default.constants.R_OK);
            }
            catch (e) {
                if (e.code === 'EACCES' || e.code === 'EPERM') {
                    const osError = `Access denied by SYSTEM: Permission denied for ${filePath}. This is likely a macOS TCC restriction. Please grant 'Full Disk Access' to your terminal/IDE in System Settings.`;
                    console.error(`[checkPath] ${osError}`);
                    throw new Error(osError);
                }
            }
            console.log(`[checkPath] Resolved: ${filePath} -> ${resolvedPath} (Restrict: ${restrictToWorkspace})`);
            return resolvedPath;
        };
        const getModel = () => {
            const modelId = this.config.agents.defaults.model;
            try {
                return (0, registry_js_1.createModel)(modelId, this.config);
            }
            catch (error) {
                this.log.error({ err: error, modelId }, 'Failed to create model for tool');
                return null;
            }
        };
        // Create standard tools with context
        const fsTools = (0, fs_js_1.createFsTools)(options, checkPath);
        const communicationTools = (0, communication_js_1.createCommunicationTools)(options);
        const visionTools = (0, vision_js_1.createVisionTools)(options, checkPath, getModel);
        const systemTools = (0, system_js_1.createSystemTools)(options, checkPath);
        const webTools = (0, web_js_1.createWebTools)(options);
        const agentTools = (0, agent_js_1.createAgentTools)(options);
        const memoryTools = (0, memory_js_1.createMemoryTools)(options);
        // 高风险工具的轻量限流器（滑动窗口计数），避免命令/网络工具被滥用
        const execRate = this.config.tools?.exec?.rate_limits;
        const webRate = this.config.tools?.web?.rate_limits;
        const rateLimits = {
            runCommand: {
                windowMs: (execRate?.runcommand_window_seconds ?? 30) * 1000,
                max: execRate?.runcommand_max ?? 5,
                hits: [],
            },
            webFetch: {
                windowMs: (webRate?.webfetch_window_seconds ?? 30) * 1000,
                max: webRate?.webfetch_max ?? 10,
                hits: [],
            },
        };
        const wrapWithRateLimit = (toolName, toolImpl) => {
            const limitCfg = rateLimits[toolName];
            if (!limitCfg || typeof toolImpl?.execute !== 'function')
                return toolImpl;
            const originalExecute = toolImpl.execute;
            toolImpl.execute = async (...args) => {
                const now = Date.now();
                limitCfg.hits = limitCfg.hits.filter(t => now - t < limitCfg.windowMs);
                const remaining = limitCfg.max - limitCfg.hits.length;
                if (toolName === 'runCommand') {
                    cleanup_js_1.housekeepingStats.rate_limits.runcommand_remaining = Math.max(0, remaining);
                }
                else if (toolName === 'webFetch') {
                    cleanup_js_1.housekeepingStats.rate_limits.webfetch_remaining = Math.max(0, remaining);
                }
                if (limitCfg.hits.length >= limitCfg.max) {
                    if (toolName === 'runCommand') {
                        cleanup_js_1.housekeepingStats.rate_limits.runcommand_triggers += 1;
                        this.log.warn({ tool: toolName, windowMs: limitCfg.windowMs, max: limitCfg.max }, 'runCommand rate limited');
                    }
                    else if (toolName === 'webFetch') {
                        cleanup_js_1.housekeepingStats.rate_limits.webfetch_triggers += 1;
                        this.log.warn({ tool: toolName, windowMs: limitCfg.windowMs, max: limitCfg.max }, 'webFetch rate limited');
                    }
                    const retryAfter = Math.ceil((limitCfg.windowMs - (now - limitCfg.hits[0])) / 1000);
                    return { error: `Rate limited: ${toolName} exceeds ${limitCfg.max} calls/${limitCfg.windowMs / 1000}s. Retry after ~${retryAfter}s.` };
                }
                limitCfg.hits.push(now);
                const remainingAfter = limitCfg.max - limitCfg.hits.length;
                if (toolName === 'runCommand') {
                    cleanup_js_1.housekeepingStats.rate_limits.runcommand_remaining = Math.max(0, remainingAfter);
                }
                else if (toolName === 'webFetch') {
                    cleanup_js_1.housekeepingStats.rate_limits.webfetch_remaining = Math.max(0, remainingAfter);
                }
                return originalExecute.apply(toolImpl, args);
            };
            return toolImpl;
        };
        // 注册工具
        const toolsMap = {
            tools: {
                ...fsTools,
                ...communicationTools,
                ...visionTools,
                ...systemTools,
                ...webTools,
                ...agentTools,
                ...memoryTools,
                ...this.pluginTools,
            },
            initPromise: Promise.resolve()
        };
        // 包裹限流的工具
        ['runCommand', 'webFetch'].forEach(name => {
            if (toolsMap.tools[name]) {
                toolsMap.tools[name] = wrapWithRateLimit(name, toolsMap.tools[name]);
            }
        });
        return toolsMap;
    }
    getToolDefinitionsSummary() {
        const { tools } = this.getTools();
        const toolDefinitions = Object.entries(tools).map(([name, tool]) => {
            return `- **${name}**: ${tool.description}`;
        }).join('\n');
        return toolDefinitions;
    }
}
exports.ToolRegistry = ToolRegistry;
