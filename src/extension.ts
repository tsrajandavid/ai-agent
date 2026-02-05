import * as vscode from 'vscode';
import { ProjectIndexer } from './services/project-indexer';
import { ChatPanelProvider } from './webview/ChatPanelProvider';
import { LLMService } from './llm/llm-service';
import { ToolManager } from './tools/tool-manager';
import { ReadFileTool, ListDirTool, WriteFileTool, EditFileTool, SearchFilesTool, GrepTool } from './tools/file-tools';
import { RunCommandTool } from './tools/terminal-tools';
import { GitStatusTool, GitDiffTool, GitLogTool } from './tools/git-tools';
import { SnapshotService } from './services/snapshot-service';

let projectIndexer: ProjectIndexer | undefined;
let toolManager: ToolManager;

// Helper function to register all tools
function registerTools(rootPath: string) {
    if (!rootPath) {
        console.warn('[AI Agent] Cannot register tools: no rootPath provided');
        return;
    }

    // Skip if already registered
    if (toolManager.getRegisteredToolNames().length > 0) {
        console.log('[AI Agent] Tools already registered, skipping');
        return;
    }

    console.log('[AI Agent] Registering tools with rootPath:', rootPath);
    // File tools
    toolManager.registerTool(new ReadFileTool(rootPath));
    toolManager.registerTool(new ListDirTool(rootPath));
    toolManager.registerTool(new WriteFileTool(rootPath));
    toolManager.registerTool(new EditFileTool(rootPath));
    toolManager.registerTool(new SearchFilesTool(rootPath));
    toolManager.registerTool(new GrepTool(rootPath));
    // Terminal & Git tools
    toolManager.registerTool(new RunCommandTool(rootPath));
    toolManager.registerTool(new GitStatusTool(rootPath));
    toolManager.registerTool(new GitDiffTool(rootPath));
    toolManager.registerTool(new GitLogTool(rootPath));
    console.log('[AI Agent] Registered tools:', toolManager.getRegisteredToolNames());
}

// Get current workspace root path
function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    console.log('[AI Agent] getWorkspaceRoot - folders:', folders?.map(f => f.uri.fsPath));
    if (folders && folders.length > 0) {
        return folders[0].uri.fsPath;
    }
    return undefined;
}

// Ensure tools are registered (call this when needed)
function ensureToolsRegistered(): boolean {
    console.log('[AI Agent] ensureToolsRegistered called');
    console.log('[AI Agent] toolManager exists:', !!toolManager);
    console.log('[AI Agent] Current tools:', toolManager?.getRegisteredToolNames());

    if (toolManager && toolManager.getRegisteredToolNames().length > 0) {
        console.log('[AI Agent] Tools already registered');
        return true;
    }

    const rootPath = getWorkspaceRoot();
    console.log('[AI Agent] rootPath:', rootPath);

    if (rootPath) {
        registerTools(rootPath);
        console.log('[AI Agent] Tools after registration:', toolManager.getRegisteredToolNames());
        return toolManager.getRegisteredToolNames().length > 0;
    }

    // Try using active text editor's document as fallback
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const docPath = activeEditor.document.uri.fsPath;
        const dirPath = require('path').dirname(docPath);
        console.log('[AI Agent] Using active editor path as fallback:', dirPath);
        registerTools(dirPath);
        return toolManager.getRegisteredToolNames().length > 0;
    }

    console.warn('[AI Agent] Cannot register tools: no workspace folder open');
    return false;
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
        vscode.window.showWarningMessage(
            'AI Agent: Please open a folder to enable file tools.',
            'Open Folder'
        ).then(selection => {
            if (selection === 'Open Folder') {
                vscode.commands.executeCommand('vscode.openFolder');
            }
        });
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

    // Register command to manually refresh tools (useful for debugging)
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-agent.refreshTools', () => {
            const currentRoot = getWorkspaceRoot();
            if (currentRoot) {
                // Clear existing tools first
                toolManager = new ToolManager();
                registerTools(currentRoot);
                vscode.window.showInformationMessage(`AI Agent: Tools registered for ${currentRoot}`);
            } else {
                vscode.window.showWarningMessage('AI Agent: No workspace folder. Please open a folder first.');
            }
        })
    );

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
    const provider = new ChatPanelProvider(
        context.extensionUri,
        context,
        llmService,
        projectIndexer,
        toolManager,
        ensureToolsRegistered  // Pass the function to ensure tools are registered
    );
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
