import * as vscode from 'vscode';
import { ProjectIndexer } from './services/project-indexer';
import { ChatPanelProvider } from './webview/ChatPanelProvider';
import { LLMService } from './llm/llm-service';
import { ToolManager } from './tools/tool-manager';
import { ReadFileTool, ListDirTool, WriteFileTool } from './tools/file-tools';
import { RunCommandTool } from './tools/terminal-tools';
import { GitStatusTool, GitDiffTool, GitLogTool } from './tools/git-tools';
import { SnapshotService } from './services/snapshot-service';

let projectIndexer: ProjectIndexer | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI Agent activated!');

    // Initialize Indexer and Services
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let rootPath = "";

    if (workspaceFolders) {
        rootPath = workspaceFolders[0].uri.fsPath;
        projectIndexer = new ProjectIndexer(rootPath);
        await projectIndexer.initialize(); // Initialize watcher

        // Initial scan
        console.log('Indexing project...');
        const projectState = await projectIndexer.scanFiles();
        console.log(`Indexed ${projectState.files.length} files.`);
        console.log(`Detected Frameworks: ${projectState.frameworks.join(', ')}`);
    }

    // Initialize LLM Service
    const llmService = new LLMService(context);

    // Initialize Snapshot Service (Optional, needs rootPath)
    if (rootPath) {
        const snapshotService = new SnapshotService(rootPath);
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
    }

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

    // Initialize Tools
    const toolManager = new ToolManager();
    if (rootPath) {
        toolManager.registerTool(new ReadFileTool(rootPath));
        toolManager.registerTool(new ListDirTool(rootPath));
        toolManager.registerTool(new WriteFileTool(rootPath));
        toolManager.registerTool(new RunCommandTool(rootPath));
        toolManager.registerTool(new GitStatusTool(rootPath));
        toolManager.registerTool(new GitDiffTool(rootPath));
        toolManager.registerTool(new GitLogTool(rootPath));
    }

    // Register Webview Provider (ALWAYS)
    const provider = new ChatPanelProvider(context.extensionUri, context, llmService, projectIndexer, toolManager);
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

export function deactivate() {
    console.log('AI Agent deactivated!');
    projectIndexer?.dispose();
}
