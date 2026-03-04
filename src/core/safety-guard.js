"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyGuard = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_js_1 = require("./config.js");
const dsmlHallucinationPattern = /<｜DSML｜function_calls>(?:[\s\S]*?<\/｜DSML｜function_calls>|[\s\S]*$)/gim;
const directivePattern = /^\s*(?:SEND_FILE|SEND_IMAGE|SEND_VOICE):\s*([^\n\r]+)/gim;
class SafetyGuard {
    constructor(config) {
        this.config = config;
    }
    isInsideCodeBlock(text, pos) {
        const prefix = text.substring(0, pos);
        const codeBlocks = prefix.match(/```/g);
        return codeBlocks && codeBlocks.length % 2 !== 0;
    }
    detectHallucination(history) {
        const lastMsg = history[history.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            let text = '';
            if (typeof lastMsg.content === 'string') {
                text = lastMsg.content;
            }
            else if (Array.isArray(lastMsg.content)) {
                const textPart = lastMsg.content.find((c) => c.type === 'text');
                if (textPart)
                    text = textPart.text || '';
            }
            if (text.match(dsmlHallucinationPattern)) {
                return true;
            }
        }
        return false;
    }
    detectIntentMismatch() {
        return false; // Disabled as per user request for generalized behavior
    }
    cleanOutput(text) {
        if (!text)
            return '';
        let cleanedText = text;
        if (cleanedText.match(dsmlHallucinationPattern)) {
            cleanedText = cleanedText.replace(dsmlHallucinationPattern, '').trim();
        }
        return cleanedText;
    }
    validateDirectives(text, hasToolCalls) {
        let cleanedText = text || '';
        let hasActualHallucination = false;
        if (cleanedText.match(directivePattern) && !hasToolCalls) {
            const workspacePath = (0, config_js_1.getWorkspacePath)(this.config);
            const newText = cleanedText.replace(directivePattern, (match, filePath, offset) => {
                if (this.isInsideCodeBlock(cleanedText, offset))
                    return match;
                const pathToCheck = filePath.trim().replace(/["']$/g, '').replace(/^["']/g, '').trim();
                const absolutePath = path_1.default.isAbsolute(pathToCheck) ? pathToCheck : path_1.default.join(workspacePath, pathToCheck);
                const isVideo = pathToCheck.toLowerCase().match(/\.(mp4|mov|avi|mkv|wmv)$/);
                if (fs_extra_1.default.existsSync(absolutePath) || isVideo) {
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
    parseDirectives(text) {
        const directives = [];
        if (!text)
            return { directives, cleanText: '' };
        const matches = text.match(directivePattern);
        if (matches) {
            matches.forEach(m => directives.push(m.trim()));
        }
        const cleanText = text.replace(directivePattern, '').trim();
        return { directives, cleanText };
    }
}
exports.SafetyGuard = SafetyGuard;
