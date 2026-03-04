"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillsLoader = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const which_1 = __importDefault(require("which"));
const constants_js_1 = require("./constants.js");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
// Built-in skills directory
const BUILTIN_SKILLS_DIR = path_1.default.resolve(__dirname, '../../', constants_js_1.DIRS.SKILLS);
class SkillsLoader {
    constructor(workspace, builtinSkillsDir) {
        this.cache = new Map();
        this.workspace = workspace;
        this.workspaceSkills = path_1.default.join(workspace, constants_js_1.DIRS.SKILLS);
        this.builtinSkills = builtinSkillsDir || BUILTIN_SKILLS_DIR;
    }
    clearCache() {
        this.cache.clear();
    }
    async listSkills(filterUnavailable = true) {
        const skills = [];
        // Workspace skills
        if (await fs_extra_1.default.pathExists(this.workspaceSkills)) {
            const dirs = await fs_extra_1.default.readdir(this.workspaceSkills);
            for (const name of dirs) {
                const skillDir = path_1.default.join(this.workspaceSkills, name);
                const skillFile = path_1.default.join(skillDir, constants_js_1.FILES.SKILL);
                if ((await fs_extra_1.default.stat(skillDir)).isDirectory() && (await fs_extra_1.default.pathExists(skillFile))) {
                    skills.push({ name, path: skillFile, source: 'workspace' });
                }
            }
        }
        // Built-in skills
        if (await fs_extra_1.default.pathExists(this.builtinSkills)) {
            const dirs = await fs_extra_1.default.readdir(this.builtinSkills);
            for (const name of dirs) {
                const skillDir = path_1.default.join(this.builtinSkills, name);
                const skillFile = path_1.default.join(skillDir, constants_js_1.FILES.SKILL);
                if ((await fs_extra_1.default.stat(skillDir)).isDirectory() && (await fs_extra_1.default.pathExists(skillFile)) && !skills.find(s => s.name === name)) {
                    skills.push({ name, path: skillFile, source: 'builtin' });
                }
            }
        }
        if (filterUnavailable) {
            const filtered = [];
            for (const skill of skills) {
                if (await this.checkRequirements(skill.name)) {
                    filtered.push(skill);
                }
            }
            return filtered;
        }
        return skills;
    }
    async loadParsedSkill(name) {
        if (this.cache.has(name)) {
            return this.cache.get(name);
        }
        let skillPath = path_1.default.join(this.workspaceSkills, name, constants_js_1.FILES.SKILL);
        if (!(await fs_extra_1.default.pathExists(skillPath))) {
            skillPath = path_1.default.join(this.builtinSkills, name, constants_js_1.FILES.SKILL);
            if (!(await fs_extra_1.default.pathExists(skillPath))) {
                return null;
            }
        }
        const raw = await fs_extra_1.default.readFile(skillPath, 'utf-8');
        const { body, metadata } = this.parseSkillContent(raw);
        const parsed = { raw, body, metadata };
        this.cache.set(name, parsed);
        return parsed;
    }
    async loadSkill(name) {
        const parsed = await this.loadParsedSkill(name);
        return parsed ? parsed.raw : null;
    }
    async buildSkillsSummary() {
        const allSkills = await this.listSkills(false);
        if (allSkills.length === 0)
            return '';
        const lines = [];
        for (const s of allSkills) {
            const parsed = await this.loadParsedSkill(s.name);
            if (!parsed)
                continue;
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
    async loadSkillsForContext(skillNames) {
        const parts = [];
        for (const name of skillNames) {
            const parsed = await this.loadParsedSkill(name);
            if (parsed) {
                parts.push(`### Skill: ${name}\n\n${parsed.body}`);
            }
        }
        return parts.join('\n\n---\n\n');
    }
    async getAlwaysSkills() {
        const result = [];
        const allSkills = await this.listSkills(true);
        for (const s of allSkills) {
            const parsed = await this.loadParsedSkill(s.name);
            const meta = parsed?.metadata;
            if (meta?.always === 'true' || meta?.metadata?.nanobot?.always === true) {
                result.push(s.name);
            }
        }
        return result;
    }
    parseSkillContent(content) {
        const metadata = {};
        let body = content;
        if (content.startsWith('---')) {
            const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (match) {
                body = match[2].trim();
                const frontmatter = match[1];
                for (const line of frontmatter.split('\n')) {
                    const firstColon = line.indexOf(':');
                    if (firstColon === -1)
                        continue;
                    const key = line.substring(0, firstColon).trim();
                    const value = line.substring(firstColon + 1).trim();
                    if (key === 'metadata') {
                        try {
                            metadata[key] = JSON.parse(value);
                        }
                        catch (e) {
                            metadata[key] = value;
                        }
                    }
                    else {
                        metadata[key] = value.replace(/^["']|["']$/g, '');
                    }
                }
            }
        }
        return { body, metadata };
    }
    async getSkillMetadata(name) {
        const parsed = await this.loadParsedSkill(name);
        return parsed ? parsed.metadata : null;
    }
    async checkRequirements(name) {
        const metadata = await this.getSkillMetadata(name);
        if (!metadata || !metadata.metadata?.nanobot?.requires)
            return true;
        const reqs = metadata.metadata.nanobot.requires;
        // Check binaries
        if (Array.isArray(reqs.bins)) {
            for (const bin of reqs.bins) {
                try {
                    await (0, which_1.default)(bin);
                }
                catch (e) {
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
    async getMissingRequirements(name) {
        const metadata = await this.getSkillMetadata(name);
        if (!metadata || !metadata.metadata?.nanobot?.requires)
            return null;
        const reqs = metadata.metadata.nanobot.requires;
        const missing = [];
        // Check binaries
        if (Array.isArray(reqs.bins)) {
            for (const bin of reqs.bins) {
                try {
                    await (0, which_1.default)(bin);
                }
                catch (e) {
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
exports.SkillsLoader = SkillsLoader;
