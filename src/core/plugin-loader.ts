import fs from 'fs-extra';
import path from 'path';
import { ToolOptions } from '../tools/types.js';
import { DIRS } from './constants.js';
import { Plugin } from './plugin.js';

export class PluginLoader {
  private workspace: string;
  private pluginsDir: string;
  private skillsDir: string;
  private loadedPlugins: Map<string, Plugin> = new Map();

  constructor(workspace: string) {
    this.workspace = workspace;
    this.pluginsDir = path.join(workspace, DIRS.PLUGINS);
    this.skillsDir = path.join(workspace, DIRS.SKILLS);
  }

  public async loadPlugins(options: ToolOptions): Promise<Record<string, any>> {
    const tools: Record<string, any> = {};

    // 1. Load from plugins/ directory
    if (await fs.pathExists(this.pluginsDir)) {
      await this.loadPluginsFromDir(this.pluginsDir, tools, options);
    }

    // 2. Load from skills/ directory (if skill acts as a plugin)
    if (await fs.pathExists(this.skillsDir)) {
      await this.loadPluginsFromDir(this.skillsDir, tools, options);
    }

    return tools;
  }

  private async loadPluginsFromDir(dir: string, tools: Record<string, any>, options: ToolOptions) {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      // Support both directory-based plugins (index.js/ts) and file-based plugins (.js)
      const fullPath = path.join(dir, item);
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
            } else if (await fs.pathExists(path.join(fullPath, 'index.ts'))) {
                entryPoint = path.join(fullPath, 'index.ts');
            } else if (await fs.pathExists(path.join(fullPath, 'dist', 'index.js'))) {
                 entryPoint = path.join(fullPath, 'dist', 'index.js');
            }
        }
      } else if (item.endsWith('.js') || (item.endsWith('.ts') && !item.endsWith('.d.ts'))) {
        entryPoint = fullPath;
      }

      if (entryPoint) {
        try {
          // Dynamic import
          const module = await import(entryPoint);
          const pluginFactory = module.default;

          if (typeof pluginFactory !== 'function' && typeof pluginFactory?.init !== 'function') {
             // Silently skip if it's just a random script or skill without plugin export
             // Only warn if it looks like it *tried* to be a plugin but failed
             continue;
          }

          console.log(`[PluginLoader] Loading plugin: ${item} from ${entryPoint}`);

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

          if (this.loadedPlugins.has(plugin.name || item)) {
            console.warn(`[PluginLoader] Plugin ${plugin.name || item} already loaded. Skipping duplicate.`);
            continue;
          }

          this.loadedPlugins.set(plugin.name || item, plugin);
          const pluginTools = await plugin.init(options);
          
          Object.assign(tools, pluginTools);
          console.log(`[PluginLoader] Loaded ${Object.keys(pluginTools).length} tools from plugin ${plugin.name || item}`);

        } catch (error) {
          // Ignore errors from non-plugin files in skills directory to avoid noise
          if (dir === this.pluginsDir) {
             console.error(`[PluginLoader] Failed to load plugin ${item}:`, error);
          }
        }
      }
    }
  }
}
