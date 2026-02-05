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
let toolManager: ToolManager;

// Helper function to register all tools
function registerTools(rootPath: string) {
    console.log('[AI Agent] Registering tools with rootPath:', rootPath);
    toolManager.registerTool(new ReadFileTool(rootPath));
    toolManager.registerTool(new ListDirTool(rootPath));
    toolManager.registerTool(new WriteFileTool(rootPath));
    toolManager.registerTool(new RunCommandTool(rootPath));
    toolManager.registerTool(new GitStatusTool(rootPath));
    toolManager.registerTool(new GitDiffTool(rootPath));
    toolManager.registerTool(new GitLogTool(rootPath));
    console.log('[AI Agent] Registered tools:', toolManager.getRegisteredToolNames());
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('[AI Agent] Extension activating...');

    // Initialize Tool Manager first (tools will be registered when workspace is available)
    toolManager = new ToolManager();

    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let rootPath = "";

    console.log('[AI Agent] Workspace folders:', workspaceFolders?.map(f => f.uri.fsPath));

    if (workspaceFolders && workspaceFolders.length > 0) {
        rootPath = workspaceFolders[0].uri.fsPath;
        console.log('[AI Agent] Using rootPath:', rootPath);

        // Register tools immediately
        registerTools(rootPath);

        // Initialize project indexer
        projectIndexer = new ProjectIndexer(rootPath);
        await projectIndexer.initialize();

        console.log('[AI Agent] Indexing project...');
        const projectState = await projectIndexer.scanFiles();
        console.log(`[AI Agent] Indexed ${projectState.files.length} files.`);
        console.log(`[AI Agent] Detected Frameworks: ${projectState.frameworks.join(', ')}`);
    } else {
        console.warn('[AI Agent] No workspace folder open!');
        vscode.window.showWarningMessage('AI Agent: Please open a folder to enable file tools.');
    }

    // Listen for workspace folder changes (user opens a folder later)
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders((event) => {
            console.log('[AI Agent] Workspace folders changed:', event);
            if (event.added.length > 0 && toolManager.getRegisteredToolNames().length === 0) {
                const newRootPath = event.added[0].uri.fsPath;
                registerTools(newRootPath);
                vscode.window.showInformationMessage('AI Agent: Tools are now available!');
            }
        })
    );

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
