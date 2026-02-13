import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import which from 'which';
import { DIRS, FILES } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Built-in skills directory
const BUILTIN_SKILLS_DIR = path.resolve(__dirname, '../../', DIRS.SKILLS);

export interface SkillInfo {
  name: string;
  path: string;
  source: 'workspace' | 'builtin';
}

interface ParsedSkill {
  raw: string;
  body: string;
  metadata: any;
}

export class SkillsLoader {
  private workspace: string;
  private workspaceSkills: string;
  private builtinSkills: string;
  private cache = new Map<string, ParsedSkill>();

  constructor(workspace: string, builtinSkillsDir?: string) {
    this.workspace = workspace;
    this.workspaceSkills = path.join(workspace, DIRS.SKILLS);
    this.builtinSkills = builtinSkillsDir || BUILTIN_SKILLS_DIR;
  }

  public clearCache() {
    this.cache.clear();
  }

  public async listSkills(filterUnavailable = true): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    // Workspace skills
    if (await fs.pathExists(this.workspaceSkills)) {
      const dirs = await fs.readdir(this.workspaceSkills);
      for (const name of dirs) {
        const skillDir = path.join(this.workspaceSkills, name);
        const skillFile = path.join(skillDir, FILES.SKILL);
        if ((await fs.stat(skillDir)).isDirectory() && (await fs.pathExists(skillFile))) {
          skills.push({ name, path: skillFile, source: 'workspace' });
        }
      }
    }

    // Built-in skills
    if (await fs.pathExists(this.builtinSkills)) {
      const dirs = await fs.readdir(this.builtinSkills);
      for (const name of dirs) {
        const skillDir = path.join(this.builtinSkills, name);
        const skillFile = path.join(skillDir, FILES.SKILL);
        if ((await fs.stat(skillDir)).isDirectory() && (await fs.pathExists(skillFile)) && !skills.find(s => s.name === name)) {
          skills.push({ name, path: skillFile, source: 'builtin' });
        }
      }
    }

    if (filterUnavailable) {
      const filtered: SkillInfo[] = [];
      for (const skill of skills) {
        if (await this.checkRequirements(skill.name)) {
          filtered.push(skill);
        }
      }
      return filtered;
    }

    return skills;
  }

  private async loadParsedSkill(name: string): Promise<ParsedSkill | null> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    let skillPath = path.join(this.workspaceSkills, name, FILES.SKILL);
    if (!(await fs.pathExists(skillPath))) {
      skillPath = path.join(this.builtinSkills, name, FILES.SKILL);
      if (!(await fs.pathExists(skillPath))) {
        return null;
      }
    }

    const raw = await fs.readFile(skillPath, 'utf-8');
    const { body, metadata } = this.parseSkillContent(raw);
    
    const parsed: ParsedSkill = { raw, body, metadata };
    this.cache.set(name, parsed);
    return parsed;
  }

  public async loadSkill(name: string): Promise<string | null> {
    const parsed = await this.loadParsedSkill(name);
    return parsed ? parsed.raw : null;
  }

  public async buildSkillsSummary(): Promise<string> {
    const allSkills = await this.listSkills(false);
    if (allSkills.length === 0) return '';

    const lines = [];
    for (const s of allSkills) {
      const parsed = await this.loadParsedSkill(s.name);
      if (!parsed) continue;

      const metadata = parsed.metadata;
      const available = await this.checkRequirements(s.name); // Will use cache internally via loadParsedSkill
      const desc = metadata?.description || s.name;
      const status = available ? 'Available' : 'Unavailable (Missing Requirements)';
      
      lines.push(`### ${s.name} [${status}]`);
      lines.push(`- **Description**: ${desc}`);
      lines.push(`- **Location**: ${s.path}`);
      
      if (!available) {
        const missing = await this.getMissingRequirements(s.name);
        if (missing) {
          lines.push(`- **Missing Requirements**: ${missing}`);
        }
      }
      lines.push(''); // Empty line for spacing
    }

    return lines.join('\n');
  }

  public async loadSkillsForContext(skillNames: string[]): Promise<string> {
    const parts: string[] = [];
    for (const name of skillNames) {
      const parsed = await this.loadParsedSkill(name);
      if (parsed) {
        parts.push(`### Skill: ${name}\n\n${parsed.body}`);
      }
    }
    return parts.join('\n\n---\n\n');
  }

  public async getAlwaysSkills(): Promise<string[]> {
    const result: string[] = [];
    const allSkills = await this.listSkills(true);
    for (const s of allSkills) {
      const parsed = await this.loadParsedSkill(s.name);
      const metadata = parsed?.metadata;
      if (metadata?.always === 'true' || metadata?.metadata?.nanobot?.always === true) {
        result.push(s.name);
      }
    }
    return result;
  }

  private parseSkillContent(content: string): { body: string; metadata: any } {
    let metadata: any = {};
    let body = content;

    if (content.startsWith('---')) {
      const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (match) {
        body = match[2].trim();
        const frontmatter = match[1];
        
        for (const line of frontmatter.split('\n')) {
          const firstColon = line.indexOf(':');
          if (firstColon === -1) continue;
          
          const key = line.substring(0, firstColon).trim();
          const value = line.substring(firstColon + 1).trim();
          
          if (key === 'metadata') {
            try {
              metadata[key] = JSON.parse(value);
            } catch (e) {
              metadata[key] = value;
            }
          } else {
            metadata[key] = value.replace(/^["']|["']$/g, '');
          }
        }
      }
    }
    return { body, metadata };
  }

  private async getSkillMetadata(name: string): Promise<any> {
    const parsed = await this.loadParsedSkill(name);
    return parsed ? parsed.metadata : null;
  }

  private async checkRequirements(name: string): Promise<boolean> {
    const metadata = await this.getSkillMetadata(name);
    if (!metadata || !metadata.metadata?.nanobot?.requires) return true;

    const reqs = metadata.metadata.nanobot.requires;

    // Check binaries
    if (Array.isArray(reqs.bins)) {
      for (const bin of reqs.bins) {
        try {
          await which(bin);
        } catch (e) {
          return false;
        }
      }
    }

    // Check env vars
    if (Array.isArray(reqs.env)) {
      for (const env of reqs.env) {
        if (!process.env[env]) {
          return false;
        }
      }
    }

    return true;
  }

  private async getMissingRequirements(name: string): Promise<string | null> {
    const metadata = await this.getSkillMetadata(name);
    if (!metadata || !metadata.metadata?.nanobot?.requires) return null;

    const reqs = metadata.metadata.nanobot.requires;
    const missing: string[] = [];

    // Check binaries
    if (Array.isArray(reqs.bins)) {
      for (const bin of reqs.bins) {
        try {
          await which(bin);
        } catch (e) {
          missing.push(`binary: ${bin}`);
        }
      }
    }

    // Check env vars
    if (Array.isArray(reqs.env)) {
      for (const env of reqs.env) {
        if (!process.env[env]) {
          missing.push(`env: ${env}`);
        }
      }
    }

    return missing.length > 0 ? missing.join(', ') : null;
  }
}
