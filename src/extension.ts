import * as vscode from 'vscode';
import { ProjectIndexer } from './services/project-indexer';
import { ChatPanelProvider } from './webview/ChatPanelProvider';
import { LLMService } from './llm/llm-service';
import { ToolManager } from './tools/tool-manager';
import { ReadFileTool, ListDirTool, WriteFileTool, EditFileTool, SearchFilesTool, GrepTool } from './tools/file-tools';
import { RunCommandTool } from './tools/terminal-tools';
import { GitStatusTool, GitDiffTool, GitLogTool, GitAddTool, GitCommitTool, GitPushTool } from './tools/git-tools';
import { SnapshotService } from './services/snapshot-service';
import { TaskGroupManager } from './agent/task-group-manager';
import { JSONAdapter } from './agent/storage/json-adapter';
import { TaskPanel } from './webview/TaskPanel';

let projectIndexer: ProjectIndexer | undefined;
let toolManager: ToolManager;
let taskGroupManager: TaskGroupManager | undefined;

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
    toolManager.registerTool(new GitAddTool(rootPath));
    toolManager.registerTool(new GitCommitTool(rootPath));
    toolManager.registerTool(new GitPushTool(rootPath));
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

    // Initialize LLM Service
    const llmService = new LLMService(context);

    // Initialize Webview Provider immediately to ensure UI loads
    const provider = new ChatPanelProvider(
        context.extensionUri,
        context,
        llmService,
        projectIndexer, // might be undefined initially if not created yet, but we will create it below
        toolManager,
        taskGroupManager,
        ensureToolsRegistered
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatPanelProvider.viewType, provider)
    );

    // Register API Key commands EARLY and OUTSIDE workspace block
    console.log('[AI Agent] Registering API Key commands...');
    console.log('[AI Agent] llmService has setApiKey:', typeof (llmService as any).setApiKey);

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-agent.setApiKey', async () => {
            console.log('[AI Agent] Command ai-agent.setApiKey triggered');
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your OpenRouter API Key',
                password: true,
                ignoreFocusOut: true
            });

            if (apiKey) {
                if (typeof llmService.setApiKey === 'function') {
                    await llmService.setApiKey(apiKey);
                    vscode.window.showInformationMessage('API Key saved successfully!');
                } else {
                    vscode.window.showErrorMessage('Critical Error: llmService.setApiKey is not a function at runtime!');
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-agent.setGoogleApiKey', async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Google Gemini API Key (starts with AIza...)',
                password: true,
                ignoreFocusOut: true
            });

            if (apiKey) {
                if (typeof llmService.setGoogleApiKey === 'function') {
                    await llmService.setGoogleApiKey(apiKey);
                    vscode.window.showInformationMessage('Google API Key saved successfully!');
                } else {
                    vscode.window.showErrorMessage('Critical Error: llmService.setGoogleApiKey is not a function at runtime!');
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-agent.setGroqApiKey', async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Groq API Key',
                password: true,
                ignoreFocusOut: true
            });

            if (apiKey) {
                if (typeof llmService.setGroqApiKey === 'function') {
                    await llmService.setGroqApiKey(apiKey);
                    vscode.window.showInformationMessage('Groq API Key saved successfully!');
                } else {
                    vscode.window.showErrorMessage('Critical Error: llmService.setGroqApiKey is not a function at runtime!');
                }
            }
        })
    );

    const disposable = vscode.commands.registerCommand(
        'ai-agent.openChat',
        () => {
            vscode.commands.executeCommand('workbench.view.extension.ai-agent-sidebar');
        }
    );
    context.subscriptions.push(disposable);

    // Register Task Dashboard Command early
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-agent.openTaskDashboard', () => {
            if (taskGroupManager) {
                TaskPanel.render(context.extensionUri, taskGroupManager);
            } else {
                vscode.window.showErrorMessage('Task Manager not initialized yet. Please wait or open a workspace.');
            }
        })
    );

    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let rootPath = "";

    console.log('[AI Agent] Workspace folders:', workspaceFolders?.map(f => f.uri.fsPath));

    if (workspaceFolders && workspaceFolders.length > 0) {
        rootPath = workspaceFolders[0].uri.fsPath;
        console.log('[AI Agent] Using rootPath:', rootPath);

        // Register tools immediately
        registerTools(rootPath);

        try {
            // Initialize project indexer
            projectIndexer = new ProjectIndexer(rootPath);
            await projectIndexer.initialize();

            // Initialize Task Group Manager
            const storage = new JSONAdapter(rootPath);
            taskGroupManager = new TaskGroupManager(storage, llmService, rootPath);



            console.log('[AI Agent] Indexing project...');
            const projectState = await projectIndexer.scanFiles();
            console.log(`[AI Agent] Indexed ${projectState.files.length} files.`);
            console.log(`[AI Agent] Detected Frameworks: ${projectState.frameworks.join(', ')}`);
        } catch (error) {
            console.error('[AI Agent] Failed to initialize services:', error);
            vscode.window.showErrorMessage('AI Agent: Failed to initialize some services. Check output for details.');
        }


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

    // Re-register provider with initialized services if needed?
    // The provider holds references. Since `projectIndexer` and `taskGroupManager` are passed by value (reference to object),
    // but here we are assigning to the *variable* `projectIndexer`.
    // The provider received `undefined` because variables were undefined when passed.
    // We need to update the provider's references!

    // Quick fix: Add setServices method to ChatPanelProvider
    if (projectIndexer) {
        // We need to cast to any or add method to interface
        (provider as any).setProjectIndexer?.(projectIndexer);
    }
    if (taskGroupManager) {
        (provider as any).setTaskGroupManager?.(taskGroupManager);
    }

    // ... rest of event listeners ...
}

export function deactivate() {
    console.log('AI Agent deactivated!');
    projectIndexer?.dispose();
}
