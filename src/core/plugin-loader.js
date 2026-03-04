"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLoader = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const constants_js_1 = require("./constants.js");
class PluginLoader {
    constructor(workspace) {
        this.loadedPlugins = new Map();
        this.workspace = workspace;
        this.pluginsDir = path_1.default.join(workspace, constants_js_1.DIRS.PLUGINS);
    }
    async loadPlugins(options) {
        const tools = {};
        if (!(await fs_extra_1.default.pathExists(this.pluginsDir))) {
            return tools;
        }
        const items = await fs_extra_1.default.readdir(this.pluginsDir);
        for (const item of items) {
            // Support both directory-based plugins (index.js/ts) and file-based plugins (.js)
            const fullPath = path_1.default.join(this.pluginsDir, item);
            const stat = await fs_extra_1.default.stat(fullPath);
            let entryPoint = '';
            if (stat.isDirectory()) {
                const pkgJsonPath = path_1.default.join(fullPath, 'package.json');
                if (await fs_extra_1.default.pathExists(pkgJsonPath)) {
                    try {
                        const pkg = await fs_extra_1.default.readJson(pkgJsonPath);
                        if (pkg.main) {
                            entryPoint = path_1.default.join(fullPath, pkg.main);
                        }
                    }
                    catch (e) {
                        console.warn(`[PluginLoader] Failed to read package.json for ${item}:`, e);
                    }
                }
                if (!entryPoint) {
                    // Try index.js or index.ts
                    if (await fs_extra_1.default.pathExists(path_1.default.join(fullPath, 'index.js'))) {
                        entryPoint = path_1.default.join(fullPath, 'index.js');
                    }
                    else if (await fs_extra_1.default.pathExists(path_1.default.join(fullPath, 'dist', 'index.js'))) {
                        entryPoint = path_1.default.join(fullPath, 'dist', 'index.js');
                    }
                }
            }
            else if (item.endsWith('.js') || (item.endsWith('.ts') && !item.endsWith('.d.ts'))) {
                entryPoint = fullPath;
            }
            if (entryPoint) {
                try {
                    console.log(`[PluginLoader] Loading plugin: ${item} from ${entryPoint}`);
                    // Dynamic import
                    const module = await Promise.resolve(`${entryPoint}`).then(s => __importStar(require(s)));
                    const pluginFactory = module.default;
                    if (typeof pluginFactory !== 'function' && typeof pluginFactory?.init !== 'function') {
                        console.warn(`[PluginLoader] Plugin ${item} does not export a valid factory function or Plugin object.`);
                        continue;
                    }
                    let plugin;
                    if (typeof pluginFactory === 'function') {
                        plugin = pluginFactory(options);
                    }
                    else {
                        plugin = pluginFactory;
                    }
                    // Validate plugin structure
                    if (typeof plugin.init !== 'function') {
                        console.warn(`[PluginLoader] Plugin ${item} missing init() method.`);
                        continue;
                    }
                    this.loadedPlugins.set(plugin.name || item, plugin);
                    const pluginTools = await plugin.init(options);
                    Object.assign(tools, pluginTools);
                    console.log(`[PluginLoader] Loaded ${Object.keys(pluginTools).length} tools from plugin ${plugin.name || item}`);
                }
                catch (error) {
                    console.error(`[PluginLoader] Failed to load plugin ${item}:`, error);
                }
            }
        }
        return tools;
    }
}
exports.PluginLoader = PluginLoader;
