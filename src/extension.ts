import * as vscode from 'vscode';
import { ProjectIndexer } from './services/project-indexer';
import { ChatPanelProvider } from './webview/ChatPanelProvider';
import { LLMService } from './llm/llm-service';
import { ToolManager } from './tools/tool-manager';
import { ReadFileTool, ListDirTool, WriteFileTool } from './tools/file-tools';
import { RunCommandTool } from './tools/terminal-tools';
import { GitStatusTool, GitDiffTool, GitLogTool } from './tools/git-tools';
import { SnapshotService } from './services/snapshot-service';

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI Agent activated!');

    // Initialize Indexer
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        const indexer = new ProjectIndexer(rootPath);

        // Initial scan
        console.log('Indexing project...');
        const projectState = await indexer.scanFiles();
        console.log(`Indexed ${projectState.files.length} files.`);
        console.log(`Detected Frameworks: ${projectState.frameworks.join(', ')}`);
        // Initialize LLM Service
        const llmService = new LLMService(context);

        // Initialize Snapshot Service
        const snapshotService = new SnapshotService(rootPath);

        // Register API Key command
        context.subscriptions.push(
            vscode.commands.registerCommand('ai-agent.setApiKey', async () => {
                const apiKey = await vscode.window.showInputBox({
                    prompt: 'Enter your OpenRouter API Key',
                    password: true,
                    ignoreFocusOut: true
                });

                if (apiKey) {
                    await llmService.setApiKey(apiKey);
                    vscode.window.showInformationMessage('API Key saved successfully!');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('ai-agent.createSnapshot', async () => {
                const name = await vscode.window.showInputBox({ prompt: 'Snapshot Name' });
                if (name) {
                    try {
                        const result = await snapshotService.createSnapshot(name);
                        vscode.window.showInformationMessage(result);
                    } catch (err: any) {
                        vscode.window.showErrorMessage(err.message);
                    }
                }
            })
        );

        // Initialize Tools
        const toolManager = new ToolManager();
        toolManager.registerTool(new ReadFileTool(rootPath));
        toolManager.registerTool(new ListDirTool(rootPath));
        toolManager.registerTool(new WriteFileTool(rootPath));
        toolManager.registerTool(new RunCommandTool(rootPath));
        toolManager.registerTool(new GitStatusTool(rootPath));
        toolManager.registerTool(new GitDiffTool(rootPath));
        toolManager.registerTool(new GitLogTool(rootPath));

        const provider = new ChatPanelProvider(context.extensionUri, context, llmService, indexer, toolManager);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewType, provider)
        );

        const disposable = vscode.commands.registerCommand(
            'ai-agent.openChat',
            () => {
                vscode.commands.executeCommand('workbench.view.extension.ai-agent-sidebar');
            }
        );

        context.subscriptions.push(disposable);
    }

}

export function deactivate() {
    console.log('AI Agent deactivated!');
}
