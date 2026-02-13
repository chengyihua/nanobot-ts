import { LanguageModelV1 } from 'ai';
import { Config } from '../core/config.js';

export interface ProviderSpec {
  /** Config field name, e.g. "openai", "anthropic" */
  name: string;
  
  /** Display name for UI/Logs */
  displayName: string;
  
  /** Keywords to match model ID against (case-insensitive) */
  keywords: string[];
  
  /** Factory function to create the model instance */
  createModel: (modelId: string, config: Config) => LanguageModelV1;
  
  /** Whether this provider acts as a gateway (routing any model) */
  isGateway?: boolean;
}
