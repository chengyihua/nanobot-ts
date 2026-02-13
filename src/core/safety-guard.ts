import fs from 'fs-extra';
import path from 'path';
import { Config, getWorkspacePath } from './config.js';

const toolHallucinationPattern = /^\s*(runCommand|readFile|writeFile|listDir|editFile|describeImage|message|spawn|transcribe|synthesize|webSearch|webFetch|cron|spawnSubagent|saveMemory|switchModel|getSystemDiagnostics):\s*(\{[\s\S]*?\}|[^\s\n\r]+)/gim;
const directivePattern = /^\s*(?:SEND_FILE|SEND_IMAGE|SEND_VOICE):\s*([^\n\r]+)/gim;

export class SafetyGuard {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private isInsideCodeBlock(text: string, pos: number) {
    const prefix = text.substring(0, pos);
    const codeBlocks = prefix.match(/```/g);
    return codeBlocks && codeBlocks.length % 2 !== 0;
  }

  public detectHallucination(history: any[]): boolean {
    const lastMsg = history[history.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      let hasActualToolCalls = false;
      let text = '';
      if (typeof lastMsg.content === 'string') {
        text = lastMsg.content;
      } else if (Array.isArray(lastMsg.content)) {
        hasActualToolCalls = lastMsg.content.some((c: any) => (c as any).type === 'tool-call');
        const textPart = lastMsg.content.find((c: any) => (c as any).type === 'text');
        if (textPart) text = (textPart as any).text || '';
      }

      if (text.match(toolHallucinationPattern)) {
         let matchFound = false;
         text.replace(toolHallucinationPattern, (match, _p1, _p2, offset) => {
            if (!this.isInsideCodeBlock(text, offset)) {
               matchFound = true;
            }
            return match;
         });
         if (matchFound) return true;
      } else if (text.match(directivePattern) && !hasActualToolCalls) {
        return true;
      }
    }
    return false;
  }

  public detectIntentMismatch(text: string, hasToolCalls: boolean): boolean {
    if (hasToolCalls) return false;
    if (!text) return false;

    const lowerText = text.toLowerCase();
    const { sent_keywords, target_keywords } = this.config.behavior.intent_mismatch;

    const hasSentIntent = sent_keywords.some(k => lowerText.includes(k.toLowerCase()));
    const hasTargetIntent = target_keywords.some(k => lowerText.includes(k.toLowerCase()));

    if (hasSentIntent && hasTargetIntent) {
      console.warn(`[SafetyGuard] Detected intent-action mismatch: Assistant claims action but no tools called.`);
      return true;
    }
    return false;
  }

  public cleanOutput(text: string): string {
    if (!text) return '';
    
    let cleanedText = text;
    let currentOutputHadHallucination = false;
    
    if (cleanedText.match(toolHallucinationPattern)) {
      const newText = cleanedText.replace(toolHallucinationPattern, (match, _p1, _p2, offset) => {
        if (this.isInsideCodeBlock(cleanedText, offset)) {
          return match;
        }
        currentOutputHadHallucination = true;
        return '';
      }).trim();

      if (currentOutputHadHallucination) {
        console.warn(`[SafetyGuard] Detected hallucination in current output. Cleaning...`);
        cleanedText = newText;
      }
    }
    
    return cleanedText;
  }

  public validateDirectives(text: string, hasToolCalls: boolean): { text: string; hasHallucination: boolean } {
    let cleanedText = text || '';
    let hasActualHallucination = false;

    if (cleanedText.match(directivePattern) && !hasToolCalls) {
      const workspacePath = getWorkspacePath(this.config);
      
      const newText = cleanedText.replace(directivePattern, (match, filePath, offset) => {
        if (this.isInsideCodeBlock(cleanedText, offset)) return match;
        
        const pathToCheck = filePath.trim().replace(/["']$/g, '').replace(/^["']/g, '').trim();
        const absolutePath = path.isAbsolute(pathToCheck) ? pathToCheck : path.join(workspacePath, pathToCheck);
        
        const isVideo = pathToCheck.toLowerCase().match(/\.(mp4|mov|avi|mkv|wmv)$/);
        
        if (fs.existsSync(absolutePath) || isVideo) {
          return match; 
        }
        
        console.warn(`[SafetyGuard] Detected premature directive with non-existent file: ${pathToCheck}. Cleaning...`);
        hasActualHallucination = true;
        return '';
      }).trim();
      
      if (hasActualHallucination) {
        cleanedText = newText;
      }
    }
    
    return { text: cleanedText, hasHallucination: hasActualHallucination };
  }

  public parseDirectives(text: string): { directives: string[], cleanText: string } {
    const directives: string[] = [];
    if (!text) return { directives, cleanText: '' };

    const matches = text.match(directivePattern);
    if (matches) {
      matches.forEach(m => directives.push(m.trim()));
    }

    const cleanText = text.replace(directivePattern, '').trim();
    return { directives, cleanText };
  }
}
