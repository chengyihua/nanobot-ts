import fs from 'fs-extra';
import path from 'path';
import { ToolOptions } from '../tools/types.js';
import { DIRS } from './constants.js';
import { Plugin } from './plugin.js';

export class PluginLoader {
  private workspace: string;
  private pluginsDir: string;
  private loadedPlugins: Map<string, Plugin> = new Map();

  constructor(workspace: string) {
    this.workspace = workspace;
    this.pluginsDir = path.join(workspace, DIRS.PLUGINS);
  }

  public async loadPlugins(options: ToolOptions): Promise<Record<string, any>> {
    const tools: Record<string, any> = {};

    if (!(await fs.pathExists(this.pluginsDir))) {
      return tools;
    }

    const items = await fs.readdir(this.pluginsDir);
    
    for (const item of items) {
      // Support both directory-based plugins (index.js/ts) and file-based plugins (.js)
      const fullPath = path.join(this.pluginsDir, item);
      const stat = await fs.stat(fullPath);
      
      let entryPoint = '';
      if (stat.isDirectory()) {
        const pkgJsonPath = path.join(fullPath, 'package.json');
        if (await fs.pathExists(pkgJsonPath)) {
            try {
                const pkg = await fs.readJson(pkgJsonPath);
                if (pkg.main) {
                    entryPoint = path.join(fullPath, pkg.main);
                }
            } catch (e) {
                console.warn(`[PluginLoader] Failed to read package.json for ${item}:`, e);
            }
        }
        
        if (!entryPoint) {
            // Try index.js or index.ts
            if (await fs.pathExists(path.join(fullPath, 'index.js'))) {
                entryPoint = path.join(fullPath, 'index.js');
            } else if (await fs.pathExists(path.join(fullPath, 'dist', 'index.js'))) {
                 entryPoint = path.join(fullPath, 'dist', 'index.js');
            }
        }
      } else if (item.endsWith('.js') || (item.endsWith('.ts') && !item.endsWith('.d.ts'))) {
        entryPoint = fullPath;
      }

      if (entryPoint) {
        try {
          console.log(`[PluginLoader] Loading plugin: ${item} from ${entryPoint}`);
          // Dynamic import
          const module = await import(entryPoint);
          const pluginFactory = module.default;

          if (typeof pluginFactory !== 'function' && typeof pluginFactory?.init !== 'function') {
             console.warn(`[PluginLoader] Plugin ${item} does not export a valid factory function or Plugin object.`);
             continue;
          }

          let plugin: Plugin;
          if (typeof pluginFactory === 'function') {
              plugin = pluginFactory(options);
          } else {
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

        } catch (error) {
          console.error(`[PluginLoader] Failed to load plugin ${item}:`, error);
        }
      }
    }

    return tools;
  }
}
