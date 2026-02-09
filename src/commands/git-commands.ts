import { SlashCommand } from './command-interface';
import * as vscode from 'vscode';
import { ToolManager } from '../tools/tool-manager';

abstract class GitCommand implements SlashCommand {
    abstract name: string;
    abstract description: string;

    constructor(protected toolManager: ToolManager) { }

    protected async executeTool(toolName: string, args: any, webview: vscode.Webview): Promise<string> {
        return await this.toolManager.executeTool(toolName, args);
    }

    abstract execute(args: string, webview: vscode.Webview): Promise<void>;
}

export class GitCommitCommand extends GitCommand {
    name = '/commit';
    description = 'Commit changes (Usage: /commit [message])';

    async execute(args: string, webview: vscode.Webview): Promise<void> {
        webview.postMessage({ command: 'newMessage', text: 'Processing commit...', role: 'assistant' });

        // 1. Get diff
        const diff = await this.executeTool('git_diff', {}, webview);
        if (!diff || diff.includes('No changes') || diff.length < 5) {
            webview.postMessage({ command: 'response-complete', text: '❌ No changes to commit.', role: 'system' });
            return;
        }

        // 2. Generate message if needed
        let message = args;
        if (!message) {
            webview.postMessage({ command: 'newMessage', text: 'Generating commit message from diff...', role: 'assistant' });
            // In a real refactor, we'd call LLM here. For now, prompt user or use simple default if we can't access LLM easily.
            // But wait, the original implementation called LLM. 
            // To keep this pure, we might need to inject LLMService or a "CommitMessageGenerator".
            // For this step, let's just ask the tool to commit with a PLACEHOLDER or fail if no message.
            // Actually, the original implementation had complex logic in ChatPanelProvider. 
            // To properly refactor, we need LLMService here too.
            webview.postMessage({ command: 'response-complete', text: '❌ Please provide a commit message: `/commit <message>` (Auto-generation pending refactor)', role: 'system' });
            return;
        }

        // 3. Commit
        await this.executeTool('git_add', { files: ['.'] }, webview);
        const result = await this.executeTool('git_commit', { message }, webview);

        webview.postMessage({ command: 'response-complete', text: `✅ ${result}`, role: 'assistant' });
    }
}

export class GitDiffCommand extends GitCommand {
    name = '/diff';
    description = 'Show current git diff';

    async execute(_args: string, webview: vscode.Webview): Promise<void> {
        const result = await this.executeTool('git_diff', {}, webview);
        webview.postMessage({
            command: 'response-complete',
            text: `### Git Diff\n\`\`\`diff\n${result}\n\`\`\``,
            role: 'assistant'
        });
    }
}

export class GitStatusCommand extends GitCommand {
    name = '/status';
    description = 'Show git status';

    async execute(_args: string, webview: vscode.Webview): Promise<void> {
        const result = await this.executeTool('git_status', {}, webview);
        webview.postMessage({
            command: 'response-complete',
            text: `### Git Status\n\`\`\`json\n${result}\n\`\`\``,
            role: 'assistant'
        });
    }
}

export class GitLogCommand extends GitCommand {
    name = '/log';
    description = 'Show recent git log';

    async execute(_args: string, webview: vscode.Webview): Promise<void> {
        const result = await this.executeTool('git_log', {}, webview);
        webview.postMessage({
            command: 'response-complete',
            text: `### Git Log\n\`\`\`json\n${result}\n\`\`\``,
            role: 'assistant'
        });
    }
}
