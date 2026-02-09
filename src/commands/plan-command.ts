import { SlashCommand } from './command-interface';
import * as vscode from 'vscode';
import { TaskGroupManager } from '../agent/task-group-manager';

export class PlanCommand implements SlashCommand {
    name = '/plan';
    description = 'Create a new task group and generate subtasks (Usage: /plan <goal>)';

    constructor(private taskGroupManager: TaskGroupManager | undefined, private updateTaskGroupCallback: (group: any) => void) { }

    async execute(argText: string, webview: vscode.Webview): Promise<void> {
        let goal = argText;

        if (!goal) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter the goal for this plan',
                placeHolder: 'e.g., Refactor authentication system',
                ignoreFocusOut: true
            });

            if (!input) {
                return; // User cancelled
            }
            goal = input;
        }

        if (!this.taskGroupManager) {
            webview.postMessage({ command: 'response-complete', text: '❌ Task Manager not initialized', role: 'system' });
            return;
        }

        webview.postMessage({ command: 'newMessage', text: 'Thinking... Creating plan and generating subtasks...', role: 'assistant' });

        // Use full text as goal, truncated as title
        const title = goal.length > 40 ? goal.substring(0, 37) + '...' : goal;
        const group = await this.taskGroupManager.create(title, goal);

        this.updateTaskGroupCallback(group);

        webview.postMessage({
            command: 'response-complete',
            text: `✅ **Plan Created:** ${title}\n\nI've broken this down into ${group.subtasks.length} subtasks and updated your project's \`task.md\`.`,
            role: 'assistant'
        });

        // Open task.md automatically
        try {
            const taskPath = this.taskGroupManager.getRootTaskPath();
            const uri = vscode.Uri.file(taskPath);
            await vscode.commands.executeCommand('markdown.showPreview', uri);
        } catch (e) {
            console.error('[PlanCommand] Failed to open task.md preview:', e);
        }
    }
}
