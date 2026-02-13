import { ToolOptions } from '../tools/types.js';

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  init: (options: ToolOptions) => Promise<Record<string, any>>;
}

export type PluginFactory = (options: ToolOptions) => Plugin;
