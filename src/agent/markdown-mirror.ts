import * as fs from 'fs';
import * as path from 'path';
import { TaskGroup } from './task-group-types';

export class MarkdownMirror {
    private tasksDir: string;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.tasksDir = path.join(workspaceRoot, '.agent', 'tasks');
        if (!fs.existsSync(this.tasksDir)) {
            fs.mkdirSync(this.tasksDir, { recursive: true });
        }
    }

    public async sync(taskGroup: TaskGroup): Promise<void> {
        const filename = `task-${taskGroup.id.slice(0, 8)}.md`;
        const filepath = path.join(this.tasksDir, filename);
        const content = this.generateMarkdown(taskGroup);

        try {
            // 1. Sync to internal archive
            await fs.promises.writeFile(filepath, content, 'utf-8');

            // 2. Sync to active-task.md if in progress
            if (taskGroup.status === 'in-progress') {
                await fs.promises.writeFile(path.join(this.tasksDir, 'active-task.md'), content, 'utf-8');
            }

            // 3. Sync to root task.md (the user-facing one)
            if (taskGroup.status === 'in-progress' || taskGroup.status === 'not-started') {
                const rootPath = path.join(this.workspaceRoot, 'task.md');

                // Retry loop for root file (might be locked by preview)
                let attempts = 0;
                while (attempts < 3) {
                    try {
                        await fs.promises.writeFile(rootPath, content, 'utf-8');
                        break; // Success
                    } catch (e) {
                        attempts++;
                        if (attempts === 3) throw e;
                        await new Promise(resolve => setTimeout(resolve, 200 * attempts));
                    }
                }
            }
        } catch (error) {
            console.error(`[MarkdownMirror] Critical failure syncing task ${taskGroup.id}:`, error);
            throw error; // Re-throw so the tool knows it failed
        }
    }

    public async delete(taskId: string): Promise<void> {
        const filename = `task-${taskId.slice(0, 8)}.md`;
        const filepath = path.join(this.tasksDir, filename);
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
        }

        // Also attempt to delete the root task.md if it exists
        const rootTaskPath = path.join(this.workspaceRoot, 'task.md');
        if (fs.existsSync(rootTaskPath)) {
            try {
                await fs.promises.unlink(rootTaskPath);
            } catch (e) {
                // Ignore errors if file is already gone or locked
            }
        }
    }

    private generateMarkdown(group: TaskGroup): string {
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
