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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownMirror = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MarkdownMirror {
    constructor(workspaceRoot) {
        this.tasksDir = path.join(workspaceRoot, '.agent', 'tasks');
        if (!fs.existsSync(this.tasksDir)) {
            fs.mkdirSync(this.tasksDir, { recursive: true });
        }
    }
    async sync(taskGroup) {
        const filename = `task-${taskGroup.id.slice(0, 8)}.md`;
        const filepath = path.join(this.tasksDir, filename);
        const content = this.generateMarkdown(taskGroup);
        try {
            await fs.promises.writeFile(filepath, content, 'utf-8');
            // Also update a 'current.md' symlink or copy for easy access?
            // For now, let's just write the specific file.
            // If this is the active/most recent task, maybe write to 'active-task.md' too?
            if (taskGroup.status === 'in-progress') {
                await fs.promises.writeFile(path.join(this.tasksDir, 'active-task.md'), content, 'utf-8');
            }
        }
        catch (error) {
            console.error(`[MarkdownMirror] Failed to sync task ${taskGroup.id}:`, error);
        }
    }
    async delete(taskId) {
        const filename = `task-${taskId.slice(0, 8)}.md`;
        const filepath = path.join(this.tasksDir, filename);
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
        }
    }
    generateMarkdown(group) {
        const completedSubtasks = group.subtasks.filter(s => s.status === 'completed' || s.status === 'skipped').length;
        const totalSubtasks = group.subtasks.length;
        const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
        const subtaskList = group.subtasks.map(s => {
            const mark = s.status === 'completed' ? 'x' : s.status === 'skipped' ? '-' : ' ';
            return `- [${mark}] **${s.title}**\n  ${s.description ? `_${s.description}_` : ''}`;
        }).join('\n');
        const progressLog = group.progress.slice().reverse().map(p => {
            const date = new Date(p.timestamp).toLocaleTimeString();
            const icon = p.type === 'success' ? '✅' : p.type === 'error' ? '❌' : p.type === 'warning' ? '⚠️' : 'ℹ️';
            return `- \`${date}\` ${icon} ${p.message}`;
        }).join('\n');
        return `# 📋 ${group.title}

> **Goal:** ${group.description}  
> **Status:** \`${group.status.toUpperCase()}\`  
> **Progress:** ${progressPercent}% (${completedSubtasks}/${totalSubtasks})

## Subtasks

${subtaskList || '_No subtasks yet._'}

## Progress Log

${progressLog || '_No updates yet._'}

---
_Last Updated: ${new Date().toLocaleTimeString()}_
`;
    }
}
exports.MarkdownMirror = MarkdownMirror;
