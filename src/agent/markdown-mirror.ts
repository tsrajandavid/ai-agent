import * as fs from 'fs';
import * as path from 'path';
import { TaskGroup } from './task-group-types';

export class MarkdownMirror {
    private tasksDir: string;

    constructor(workspaceRoot: string) {
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
            await fs.promises.writeFile(filepath, content, 'utf-8');
            // Also update a 'current.md' symlink or copy for easy access?
            // For now, let's just write the specific file.

            // If this is the active/most recent task, maybe write to 'active-task.md' too?
            if (taskGroup.status === 'in-progress') {
                await fs.promises.writeFile(path.join(this.tasksDir, 'active-task.md'), content, 'utf-8');
            }
        } catch (error) {
            console.error(`[MarkdownMirror] Failed to sync task ${taskGroup.id}:`, error);
        }
    }

    public async delete(taskId: string): Promise<void> {
        const filename = `task-${taskId.slice(0, 8)}.md`;
        const filepath = path.join(this.tasksDir, filename);
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
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
