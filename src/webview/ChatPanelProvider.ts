import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { LLMService } from '../llm/llm-service';
import { ProjectIndexer } from '../services/project-indexer';
import { SystemPromptGenerator, AgentMode } from '../agent/system-prompt';
import { RunCommandTool } from '../tools/terminal-tools';
import { TaskTools } from '../tools/task-tools';
import { v4 as uuidv4 } from 'uuid';
import { ToolManager } from '../tools/tool-manager';
import { TaskGroupManager } from '../agent/task-group-manager';
import { ChatStorage } from '../agent/storage/chat-storage';
import { ContextAnalyzer } from '../agent/context-analyzer';
import { JSONAdapter } from '../agent/storage/json-adapter';
import { CommandRegistry } from '../commands/command-registry';
import { PlanCommand } from '../commands/plan-command';
import { AnalyzeCommand } from '../commands/analyze-command';
import { GitCommitCommand, GitDiffCommand, GitStatusCommand, GitLogCommand } from '../commands/git-commands';
import { ActionEngine } from '../agent/action-engine';

interface WebviewMessage {
    command: string;
    text: string;
    [key: string]: any;
}

interface ConversationMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatMessage {
    role: 'user' | 'system' | 'tool';
    text: string;
    command?: string;
    tool?: string;
    result?: string;
    timestamp?: number;
}

interface PendingApproval {
    resolve: (approved: boolean) => void;
    toolName: string;
    args: any;
}

interface Conversation {
    id: string;
    title: string;
    timestamp: number;
    messages: ChatMessage[];
}

const MAX_TOOL_ITERATIONS = 10;
const OLD_CHAT_HISTORY_KEY = 'ai-agent.chatHistory';
const CONVERSATIONS_KEY = 'ai-agent.conversations';

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-agent.chatView';
    private _view?: vscode.WebviewView;

    public updateTaskGroup(taskGroup: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'update-task-group',
                taskGroup: taskGroup
            });
        }
    }

    private _currentMode: AgentMode = 'PLAN';
    private _selectedFiles: Record<string, string> = {};
    private _pendingApproval: PendingApproval | null = null;
    private commandRegistry!: CommandRegistry;
    private actionEngine: ActionEngine | undefined;

    // Multi-chat state
    private _conversations: Conversation[] = [];
    private _activeConversationId: string = '';
    private _chatStorage: ChatStorage | undefined;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _llmService: LLMService,
        private _projectIndexer: ProjectIndexer | undefined,
        private readonly _toolManager: ToolManager,
        private _taskGroupManager: TaskGroupManager | undefined,
        private readonly _ensureToolsRegistered: () => boolean
    ) {
        this.registerCommands();
        this._initializeAgentTools();
        if (this._taskGroupManager) {
            this.actionEngine = new ActionEngine(
                this._taskGroupManager,
                this._llmService,
                (prompt) => this._executeAutoStep(prompt)
            );
        }
    }

    private _initializeAgentTools() {
        // Register standard tools
        const runCommandTool = new RunCommandTool(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
        this._toolManager.registerTool(runCommandTool);

        if (this._taskGroupManager) {
            const taskTools = new TaskTools(this._taskGroupManager);
            taskTools.getTools().forEach((t: any) => this._toolManager.registerTool(t));
        }
    }

    public setProjectIndexer(indexer: ProjectIndexer) {
        this._projectIndexer = indexer;
        this.registerCommands();
        this._initializeAgentTools();
        // Trigger initial scan and update UI
        if (this._projectIndexer) {
            this._projectIndexer.scanFiles().then(state => {
                if (this._view) {
                    this._view.webview.postMessage({
                        command: 'update-file-list',
                        files: state.files.map(f => f.path)
                    });
                }
            });
        }
    }

    public setTaskGroupManager(manager: TaskGroupManager) {
        this._taskGroupManager = manager;
        this.actionEngine = new ActionEngine(
            manager,
            this._llmService,
            (prompt) => this._executeAutoStep(prompt)
        );
        this.registerCommands();
        this._initializeAgentTools();

        // Trigger initial task group update
        if (this._taskGroupManager) {
            this._taskGroupManager.getAll().then(groups => {
                if (this._view) {
                    this._view.webview.postMessage({
                        command: 'update-task-list',
                        taskGroups: groups,
                        activeGroupId: groups.find(g => g.status === 'in-progress')?.id || groups[0]?.id
                    });
                }
            });
        }
    }

    private registerCommands() {
        this.commandRegistry = new CommandRegistry();

        // Register Plan Command
        this.commandRegistry.register(new PlanCommand(this._taskGroupManager, (g) => this.updateTaskGroup(g)));

        // Register Analyze Command
        this.commandRegistry.register(new AnalyzeCommand(this._projectIndexer, this._llmService));

        // Register Git Commands
        if (this._toolManager) {
            this.commandRegistry.register(new GitCommitCommand(this._toolManager));
            this.commandRegistry.register(new GitDiffCommand(this._toolManager));
            this.commandRegistry.register(new GitStatusCommand(this._toolManager));
            this.commandRegistry.register(new GitLogCommand(this._toolManager));
        }

        // Register Resume Command
        this.commandRegistry.register({
            name: '/resume',
            description: 'Resume auto-execution of the active plan',
            execute: async (_args, webview) => {
                if (!this.actionEngine) {
                    webview.postMessage({ command: 'response-complete', text: '❌ Action Engine not initialized (No Task Manager)', role: 'system' });
                    return;
                }

                // Get active group
                const groups = await this._taskGroupManager?.getAll() || [];
                const activeGroup = groups.find(g => g.status === 'in-progress');

                if (!activeGroup) {
                    webview.postMessage({ command: 'response-complete', text: 'SOURCE: No active plan found to resume.', role: 'system' });
                    return;
                }

                webview.postMessage({ command: 'response-complete', text: `🚀 **Resuming Plan:** ${activeGroup.title}\n\nExecuting next step...`, role: 'system' });
                this.actionEngine.resume();
                this.runAutoExecutionLoop(activeGroup.id);
            }
        });

        // Register Simple Commands (Clear, Help, Reset)
        this.registerSimpleCommands();
    }

    private registerSimpleCommands() {
        // Help
        this.commandRegistry.register({
            name: '/help',
            description: 'Show help',
            execute: async (_args, webview) => {
                const commands = this.commandRegistry.getCommands().map(c => `- \`${c.name}\` - ${c.description}`).join('\n');
                webview.postMessage({ command: 'response-complete', text: `### Available Commands\n\n${commands}`, role: 'system' });
            }
        });

        // Clear
        this.commandRegistry.register({
            name: '/clear',
            description: 'Clear chat history',
            execute: async (_args, webview) => {
                webview.postMessage({ command: 'clear-chat' });
                if (this._activeChat) {
                    this._activeChat.messages = [];
                    this._saveConversations();
                }
                this._llmService.resetContext();
            }
        });

        // Reset
        this.commandRegistry.register({
            name: '/reset',
            description: 'Reset session',
            execute: async (_args, webview) => {
                this._selectedFiles = {};
                if (this._activeChat) {
                    this._activeChat.messages = [];
                    this._saveConversations();
                }
                this._llmService.resetContext();
                if (this._projectIndexer) await this._projectIndexer.scanFiles();
                webview.postMessage({ command: 'response-complete', text: '✅ Reset complete', role: 'system' });
            }
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'out'),
                vscode.Uri.joinPath(this._extensionUri, 'webview-ui/build')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this._setWebviewMessageListener(webviewView.webview);

        // Load conversations (migrating if needed)
        this._loadConversations();

        // Initial setup happens when webview sends 'webview-ready'

        if (this._projectIndexer) {
            this._projectIndexer.scanFiles().then(state => {
                webviewView.webview.postMessage({
                    command: 'update-file-list',
                    files: state.files.map(f => f.path)
                });
            });
        }
    }



    private async _loadConversations() {
        try {
            // Initialize storage if workspace available
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                this._chatStorage = new ChatStorage(workspaceFolders[0].uri.fsPath);
            }

            let loadedFromStorage = false;
            if (this._chatStorage) {
                const stored = await this._chatStorage.getAll();
                if (stored && stored.length > 0) {
                    this._conversations = stored;
                    loadedFromStorage = true;
                }
            }

            if (loadedFromStorage) {
                // Set active to most recent
                if (this._conversations.length > 0) {
                    this._conversations.sort((a, b) => b.timestamp - a.timestamp);
                    this._activeConversationId = this._conversations[0].id;
                }
            } else {
                // Migration path: Check for old globalState history
                console.log('[AI Agent] No file history. Checking globalState...');
                const storedConversations = this._context.globalState.get<Conversation[]>(CONVERSATIONS_KEY);

                if (storedConversations && Array.isArray(storedConversations) && storedConversations.length > 0) {
                    console.log('[AI Agent] Migrating globalState history to file storage');
                    this._conversations = storedConversations;
                    this._conversations.sort((a, b) => b.timestamp - a.timestamp);
                    this._activeConversationId = this._conversations[0].id;
                    // Persist to new storage immediately
                    this._saveConversations();
                } else {
                    // Check for even older single-chat history
                    const oldHistory = this._context.globalState.get<ChatMessage[]>(OLD_CHAT_HISTORY_KEY);
                    if (oldHistory && Array.isArray(oldHistory) && oldHistory.length > 0) {
                        console.log('[AI Agent] Migrating legacy history to file storage');
                        const migratedChat: Conversation = {
                            id: Date.now().toString(),
                            title: 'Previous Session',
                            timestamp: Date.now(),
                            messages: oldHistory
                        };
                        this._conversations = [migratedChat];
                        this._activeConversationId = migratedChat.id;
                        this._saveConversations();
                    } else {
                        // Start fresh
                        console.log('[AI Agent] No history found. Starting fresh.');
                        this._createNewChat();
                    }
                }
            }

            // Update UI after loading
            if (this._view) {
                this._view.webview.postMessage({
                    command: 'restore-history',
                    messages: this._activeChat?.messages || []
                });
                this._view.webview.postMessage({
                    command: 'update-conversation-list',
                    conversations: this._conversations.map(c => ({ id: c.id, title: c.title, timestamp: c.timestamp })),
                    activeId: this._activeConversationId
                });
            }
        } catch (e) {
            console.error('[AI Agent] Failed to load conversations:', e);
            this._createNewChat();
        }
    }

    private _createNewChat() {
        const newChat: Conversation = {
            id: Date.now().toString(),
            title: 'New Chat',
            timestamp: Date.now(),
            messages: []
        };
        this._conversations.unshift(newChat);
        this._activeConversationId = newChat.id;
        this._saveConversations();
        return newChat;
    }

    private async _saveConversations() {
        try {
            if (this._chatStorage) {
                await this._chatStorage.saveAll(this._conversations);
            } else {
                // Fallback for no workspace
                this._context.globalState.update(CONVERSATIONS_KEY, this._conversations);
            }
        } catch (e) {
            console.error('[AI Agent] Failed to save conversations:', e);
        }
    }

    private get _activeChat(): Conversation | undefined {
        return this._conversations.find(c => c.id === this._activeConversationId);
    }

    private _addToHistory(msg: ChatMessage) {
        const chat = this._activeChat;
        if (chat) {
            chat.messages.push({ ...msg, timestamp: Date.now() });

            // Generate title if it's the first user message and title is "New Chat"
            if (msg.role === 'user' && chat.title === 'New Chat') {
                this._generateTitle(chat.id, msg.text);
            }

            // Update timestamp to move to top
            chat.timestamp = Date.now();
            this._saveConversations();
        }
    }

    // Helper to generate simple title (first 30 chars for now)
    private _generateTitle(chatId: string, text: string) {
        const chat = this._conversations.find(c => c.id === chatId);
        if (chat) {
            chat.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
            this._saveConversations();
            // Notify UI of title update
            this._view?.webview.postMessage({
                command: 'update-conversation-list',
                conversations: this._conversations.map(c => ({ id: c.id, title: c.title, timestamp: c.timestamp }))
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const stylesUri = getUri(webview, this._extensionUri, ["webview-ui", "build", "assets", "index.css"]);
        const scriptUri = getUri(webview, this._extensionUri, ["webview-ui", "build", "assets", "index.js"]);
        const nonce = getNonce();

        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <link rel="stylesheet" type="text/css" href="${stylesUri}">
                <title>Akku AI</title>
            </head>
            <body>
                <div id="root"></div>
                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case "hello":
                        this.handleUserMessage(text, webview);
                        return;
                    case "setMode":
                        this._currentMode = text as AgentMode;
                        vscode.window.showInformationMessage(`Mode: ${text}`);
                        return;
                    case "setModel":
                        this._llmService.setModel(text);
                        return;
                    case "webview-ready":
                        // Send current chat history
                        webview.postMessage({
                            command: 'restore-history',
                            messages: this._activeChat?.messages || []
                        });
                        // Send conversation list
                        webview.postMessage({
                            command: 'update-conversation-list',
                            conversations: this._conversations.map(c => ({ id: c.id, title: c.title, timestamp: c.timestamp })),
                            activeId: this._activeConversationId
                        });
                        return;

                        // Multi-chat commands
                        return;

                    case "create-task-group-request":
                        if (!this._taskGroupManager) {
                            vscode.window.showErrorMessage("Task Group Manager not initialized");
                            return;
                        }

                        const title = await vscode.window.showInputBox({
                            title: "Task Group Title",
                            prompt: "e.g., Refactor Auth System"
                        });

                        if (!title) return;

                        const goal = await vscode.window.showInputBox({
                            title: "Task Group Goal",
                            prompt: "Describe what needs to be achieved",
                            value: title
                        });

                        if (!goal) return;

                        const newGroup = await this._taskGroupManager.create(title, goal);
                        webview.postMessage({
                            command: 'update-task-group',
                            taskGroup: newGroup
                        });
                        return;

                    case "toggle-subtask":
                        if (!this._taskGroupManager) return;
                        try {
                            const data = typeof message.text === 'string' ? JSON.parse(message.text) : message;
                            // Update subtask
                            await this._taskGroupManager.updateSubtaskStatus(
                                data.groupId,
                                data.subtaskId,
                                data.completed ? 'completed' : 'not-started'
                            );

                            // Send full update back
                            const updatedGroup = await this._taskGroupManager.get(data.groupId);
                            if (updatedGroup) {
                                webview.postMessage({
                                    command: 'update-task-group',
                                    taskGroup: updatedGroup
                                });
                            }
                        } catch (e) {
                            console.error('Failed to toggle subtask:', e);
                        }
                        return;

                    case "new-chat":
                        const newChat = this._createNewChat();
                        this._llmService.resetContext();
                        webview.postMessage({
                            command: 'restore-history',
                            messages: []
                        });
                        webview.postMessage({
                            command: 'update-conversation-list',
                            conversations: this._conversations.map(c => ({ id: c.id, title: c.title, timestamp: c.timestamp })),
                            activeId: this._activeConversationId
                        });
                        return;

                    case "load-chat":
                        try {
                            const payload = typeof message.text === 'string' ? JSON.parse(message.text) : message;
                            const chatId = payload.chatId;
                            const targetChat = this._conversations.find(c => c.id === chatId);
                            if (targetChat) {
                                this._activeConversationId = targetChat.id;
                                this._llmService.resetContext(); // Context will be rebuilt on next user message

                                webview.postMessage({
                                    command: 'restore-history',
                                    messages: targetChat.messages
                                });
                                webview.postMessage({
                                    command: 'update-conversation-list',
                                    conversations: this._conversations.map(c => ({ id: c.id, title: c.title, timestamp: c.timestamp })),
                                    activeId: this._activeConversationId
                                });
                            }
                        } catch (e) {
                            console.error('[AI Agent] Failed to load chat:', e);
                        }
                        return;

                    case "delete-chat":
                        try {
                            const payload = typeof message.text === 'string' ? JSON.parse(message.text) : message;
                            const delId = payload.chatId;
                            this._conversations = this._conversations.filter(c => c.id !== delId);
                            if (this._activeConversationId === delId) {
                                // If deleted active, switch to first or new
                                if (this._conversations.length > 0) {
                                    this._activeConversationId = this._conversations[0].id;
                                    const nextChat = this._conversations[0];
                                    webview.postMessage({
                                        command: 'restore-history',
                                        messages: nextChat.messages
                                    });
                                } else {
                                    this._createNewChat(); // Will update UI implies
                                    webview.postMessage({
                                        command: 'restore-history',
                                        messages: []
                                    });
                                }
                            }
                            this._saveConversations();
                            webview.postMessage({
                                command: 'update-conversation-list',
                                conversations: this._conversations.map(c => ({ id: c.id, title: c.title, timestamp: c.timestamp })),
                                activeId: this._activeConversationId
                            });
                        } catch (e) {
                            console.error('[AI Agent] Failed to delete chat:', e);
                        }
                        return;

                    case "refresh-files":
                        if (this._projectIndexer) {
                            this._projectIndexer.scanFiles().then(state => {
                                webview.postMessage({
                                    command: 'update-file-list',
                                    files: state.files.map(f => f.path)
                                });
                            });
                        }
                        return;
                    case "approval-response":
                        if (this._pendingApproval) {
                            // Parse the text which contains JSON
                            try {
                                const data = JSON.parse(message.text || '{}');
                                this._pendingApproval.resolve(data.approved === true);
                            } catch (e) {
                                this._pendingApproval.resolve(false);
                            }
                            this._pendingApproval = null;
                        }
                        return;
                    case "clear-history":
                        if (this._activeChat) {
                            this._activeChat.messages = [];
                            this._saveConversations();
                        }
                        return;
                    case "stop-generation":
                        this._llmService.abort();
                        if (true) { // Show feedback even if Placeholder returns true
                            webview.postMessage({
                                command: 'generation-stopped',
                                text: '⏹️ Generation stopped',
                                role: 'system'
                            });
                        }
                        return;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    /**
     * Main handler for user messages - implements the agentic loop
     */
    private async handleUserMessage(text: string, webview: vscode.Webview) {
        console.log('[AI Agent] User message:', text);

        // Echo user message to UI and save to history
        webview.postMessage({ command: 'newMessage', text, role: 'user' });
        this._addToHistory({ role: 'user', text });

        // Handle slash commands first
        if (text.startsWith('/')) {
            await this.handleSlashCommand(text, webview);
            return;
        }

        // Handle 'continue' keyword as /resume
        if (text.trim().toLowerCase() === 'continue') {
            await this.handleSlashCommand('/resume', webview);
            return;
        }

        // Auto-Detection for Complex Tasks
        // If text > 15 chars (e.g., "create next app") AND contains triggers AND not already running a plan
        const COMPLEX_TRIGGERS = ['build', 'create', 'implement', 'refactor', 'migrate', 'rewrite', 'design'];
        const isComplex = text.length > 15 && COMPLEX_TRIGGERS.some(t => text.toLowerCase().includes(t));

        // Only suggest if no active task group
        let hasActiveGroup = false;
        if (this._taskGroupManager) {
            const groups = await this._taskGroupManager.getAll();
            hasActiveGroup = !!(groups.find(g => g.status === 'in-progress'));
        }

        let isPlanRequest = false;
        if (isComplex && !hasActiveGroup && this._taskGroupManager) {
            isPlanRequest = true;
            // Prepend a strict instruction that forbids chat output
            text = `[STRICT PLAN REQUEST] Please use the "create_task_group" tool for this request. 
YOUR FINAL RESPONSE MUST ONLY BE: "Task plan created. Review task.md and type continue to proceed."
DO NOT write steps, plans, or code in this chat.
User Request: ${text}`;
        }

        // Ensure tools are registered before processing
        if (!this._ensureToolsRegistered()) {
            webview.postMessage({
                command: 'response-complete',
                text: '⚠️ **No workspace folder open**\n\nPlease open a folder to enable file tools:\n1. Press `Ctrl+K Ctrl+O` (or `Cmd+K Cmd+O` on Mac)\n2. Or use File → Open Folder\n\nThen try your request again.',
                role: 'system'
            });
            // Also prompt to open folder
            vscode.window.showWarningMessage(
                'AI Agent needs a workspace folder to use file tools.',
                'Open Folder'
            ).then(selection => {
                if (selection === 'Open Folder') {
                    vscode.commands.executeCommand('vscode.openFolder');
                }
            });
            return;
        }

        console.log('[AI Agent] Tools available:', this._toolManager.getRegisteredToolNames());

        try {
            // Get project state
            let projectState: any = { files: [], frameworks: [], dependencies: [] };
            if (this._projectIndexer) {
                try {
                    projectState = await this._projectIndexer.scanFiles();
                } catch (e) {
                    console.error('[AI Agent] Failed to scan project:', e);
                }
            }

            // Generate system prompt with workspace root for skill loading
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const promptGenerator = new SystemPromptGenerator(projectState, workspaceRoot);

            // Build messages for LLM
            // Convert stored ChatMessages to ConversationMessages (context)
            const historyContext: ConversationMessage[] = (this._activeChat?.messages || [])
                .filter(m => m.role === 'user' || m.role === 'system' || (m.role as any) === 'assistant')
                .map(m => ({
                    role: (m.role === 'tool' ? 'system' : m.role) as 'user' | 'system' | 'assistant',
                    content: m.text
                }));

            // Feed conversation history into memory for context tracking
            promptGenerator.getMemory().extractFromMessages(historyContext);

            // Get active task group
            let activeTaskGroup;
            if (this._taskGroupManager) {
                const groups = await this._taskGroupManager.getAll();
                activeTaskGroup = groups.find(g => g.status === 'in-progress') || groups.find(g => g.status === 'not-started');
            }

            // Capture recent files (visible editors)
            const recentFiles = vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath);

            // Generate system prompt with user query for context pruning
            const systemPrompt = promptGenerator.generate(this._currentMode, this._selectedFiles, text, activeTaskGroup, recentFiles);

            // Keep only last 20 messages for context window
            const recentContext = historyContext.slice(-20);

            const messages: ConversationMessage[] = [
                { role: 'system', content: systemPrompt },
                ...recentContext,
                { role: 'user', content: text }
            ];

            // Add user message to history (storage)
            // Note: _addToHistory is called above in handleUserMessage, so we don't need to push to storage here again
            // But we need to update the in-memory context for the loop if we were using a persistent array, 
            // but here 'messages' is local to this request.

            // Run the agentic loop
            await this.runAgentLoop(messages, webview, isPlanRequest);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[AI Agent] Error:', errorMessage);
            webview.postMessage({
                command: "error",
                text: `❌ Error: ${errorMessage}`,
                role: 'system'
            });
        }
    }

    /**
     * The agentic loop - continues until no more tool calls
     */
    private async runAgentLoop(messages: ConversationMessage[], webview: vscode.Webview, isPlanRequest: boolean = false) {
        let iterations = 0;

        while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;
            console.log(`[AI Agent] Loop iteration ${iterations}`);

            // Call LLM
            let fullResponse = '';
            await this._llmService.sendRequest(messages as any, (chunk) => {
                fullResponse += chunk;
                if (!isPlanRequest) {
                    webview.postMessage({ command: "stream-chunk", chunk });
                }
            });

            console.log('[AI Agent] LLM response length:', fullResponse.length);
            console.log('[AI Agent] LLM response preview:', fullResponse.slice(0, 500));

            const toolCall = this._toolManager.parseCommand(fullResponse);

            if (toolCall) {
                // Found a tool call - execute it
                console.log('[AI Agent] Tool call detected:', toolCall.command, 'args:', JSON.stringify(toolCall.args).slice(0, 200));

                const tool = this._toolManager.getTool(toolCall.command);

                // Check if tool requires confirmation
                if (tool?.requiresConfirmation) {
                    // Get file content for diff preview
                    let oldContent = '';
                    if (toolCall.args?.path) {
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (workspaceFolders) {
                                const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, toolCall.args.path);
                                const content = await vscode.workspace.fs.readFile(filePath);
                                oldContent = new TextDecoder().decode(content);
                            }
                        } catch (e) {
                            // File doesn't exist yet (new file)
                            oldContent = '';
                        }
                    }

                    // Send approval request to UI
                    console.log('[AI Agent] Sending approval-request to webview:', {
                        tool: toolCall.command,
                        filePath: toolCall.args?.path,
                        hasOldContent: !!oldContent,
                        hasNewContent: !!toolCall.args?.content
                    });
                    webview.postMessage({
                        command: "approval-request",
                        tool: toolCall.command,
                        args: toolCall.args,
                        filePath: toolCall.args?.path || '',
                        oldContent: oldContent,
                        newContent: toolCall.args?.content || '',
                        oldString: toolCall.args?.old_string || '',
                        newString: toolCall.args?.new_string || '',
                        role: 'system'
                    });

                    // Wait for user approval
                    const approved = await new Promise<boolean>((resolve) => {
                        this._pendingApproval = {
                            resolve,
                            toolName: toolCall.command,
                            args: toolCall.args
                        };
                    });

                    if (!approved) {
                        // User rejected
                        const rejectMsg = `❌ User rejected ${toolCall.command} for ${toolCall.args?.path}`;
                        webview.postMessage({
                            command: "tool-result",
                            tool: toolCall.command,
                            result: rejectMsg,
                            role: 'system'
                        });
                        messages.push({ role: 'assistant', content: fullResponse });
                        messages.push({ role: 'user', content: `Tool Result (${toolCall.command}): ${rejectMsg}` });
                        continue;
                    }
                }

                // Send tool call notification to UI
                webview.postMessage({
                    command: "tool-call",
                    tool: toolCall.command,
                    args: toolCall.args,
                    role: 'system'
                });

                // Execute the tool (skip confirmation dialog since we handled it above)
                const toolResult = await this._executeToolDirect(toolCall.command, toolCall.args);
                console.log('[AI Agent] Tool result:', toolResult.slice(0, 200) + '...');

                // Send tool result to UI
                webview.postMessage({
                    command: "tool-result",
                    tool: toolCall.command,
                    result: toolResult,
                    role: 'system'
                });

                // Add assistant response and tool result to messages for next iteration
                messages.push({ role: 'assistant', content: fullResponse });
                messages.push({ role: 'user', content: `Tool Result (${toolCall.command}):\n${toolResult}` });

                // Continue the loop to let LLM process the tool result
                continue;
            }

            // No tool call found
            console.log('[AI Agent] No tool call detected');

            // Check if user asked for file operation but LLM didn't use tool (retry once)
            const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
            const askedForFileOp = /\b(create|make|write|edit|modify|update|add|generate)\b.*\b(file|code|script|component|function)\b/i.test(lastUserMsg);

            if (askedForFileOp && iterations === 1) {
                console.log('[AI Agent] User asked for file operation but no tool used - retrying with reminder');

                // Clear the streamed content
                webview.postMessage({ command: "clear-stream" });

                // Add a strong reminder and retry
                messages.push({ role: 'assistant', content: fullResponse });
                messages.push({
                    role: 'user',
                    content: `You explained how to do it, but I need you to ACTUALLY create the file using the write_file tool. Please respond with ONLY the JSON tool call like this:
\`\`\`json
{"tool": "write_file", "args": {"path": "filename", "content": "content"}}
\`\`\`
Do not explain. Just output the JSON.`
                });
                continue; // Retry
            }

            // Add to conversation history (for LLM context in next loop iteration)
            messages.push({ role: 'assistant', content: fullResponse });

            // Send completion to UI and save to history
            webview.postMessage({
                command: "response-complete",
                text: fullResponse,
                role: 'system'
            });
            this._addToHistory({ role: 'system', text: fullResponse });

            return;
        }

        // Hit max iterations
        webview.postMessage({
            command: "response-complete",
            text: "⚠️ Reached maximum tool iterations. Please continue with a new message.",
            role: 'system'
        });
    }

    /**
     * Handle slash commands
     */
    private async handleSlashCommand(text: string, webview: vscode.Webview) {
        const [commandName, ...args] = text.split(' ');
        const argText = args.join(' ');

        // Try to execute via registry
        const handled = await this.commandRegistry.execute(commandName, argText, webview);
        if (handled) return;
        // Legacy fallback or unknown command
        webview.postMessage({ command: 'response-complete', text: `❌ Unknown command: ${commandName}`, role: 'system' });
    }


    /**
     * Auto Execution Loop
     * Iterates through the plan using ActionEngine
     */
    private async runAutoExecutionLoop(groupId: string) {
        if (!this.actionEngine) return;

        let keepGoing = true;
        while (keepGoing) {
            // Check if we should stop (e.g. paused)
            // The ActionEngine checks its own paused state, but we also handle the result here.

            try {
                // Execute next step
                // stepResult is true if it thinks we should continue, false if we should stop.
                const stepResult = await this.actionEngine.executeNextStep(groupId);

                if (!stepResult) {
                    keepGoing = false;
                    // Could be finished or paused/failed
                    const group = await this._taskGroupManager?.get(groupId);
                    if (group) {
                        const pending = group.subtasks.filter(t => t.status === 'not-started');
                        if (pending.length === 0) {
                            this._view?.webview.postMessage({
                                command: 'response-complete',
                                text: `🎉 **Plan Complete:** ${group.title}\n\nAll tasks finished.`,
                                role: 'system'
                            });
                        } else {
                            // Paused or failed
                            this._view?.webview.postMessage({
                                command: 'response-complete',
                                text: `⏸️ **Auto-Execution Paused.**`,
                                role: 'system'
                            });
                        }
                    }
                }
                // If stepResult is true, we loop again immediately

            } catch (e) {
                console.error('Auto execution error:', e);
                keepGoing = false;
                this._view?.webview.postMessage({
                    command: 'response-complete',
                    text: `❌ Error in auto-execution: ${e}`,
                    role: 'system'
                });
            }
        }
    }

    /**
     * Helper for ActionEngine to runs a single agentic loop for a specific prompt
     * Returns true if successful, false if failed/cancelled
     */
    private async _executeAutoStep(prompt: string): Promise<boolean> {
        if (!this._view) return false;

        console.log('[ChatPanelProvider] Executing Auto Step:', prompt.slice(0, 100) + '...');

        // Create a temporary conversation context or just use the current one?
        // Better to use current so the user sees the progress in the chat.

        // 1. Send prompt to UI as if it were a system/assistant message announcing the task
        this._view.webview.postMessage({ command: 'newMessage', text: `🤖 **Auto-Task:** ${prompt.split('\n')[2] || 'Executing step...'}`, role: 'assistant' });

        // 2. Construct messages
        // reuse logic from handleUserMessage but adapted

        // Get project state (simplified)
        let projectState: any = { files: [], frameworks: [], dependencies: [] };
        if (this._projectIndexer) {
            try { projectState = await this._projectIndexer.scanFiles(); } catch (e) { }
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const promptGenerator = new SystemPromptGenerator(projectState, workspaceRoot);

        // Build context
        const historyContext: ConversationMessage[] = (this._activeChat?.messages || [])
            .filter(m => m.role === 'user' || m.role === 'system' || (m.role as any) === 'assistant')
            .map(m => ({
                role: (m.role === 'tool' ? 'system' : m.role) as 'user' | 'system' | 'assistant',
                content: m.text
            }));

        let activeTaskGroup;
        if (this._taskGroupManager) {
            const groups = await this._taskGroupManager.getAll();
            activeTaskGroup = groups.find(g => g.status === 'in-progress');
        }

        const recentFiles = vscode.window.visibleTextEditors.map(editor => editor.document.uri.fsPath);
        const systemPrompt = promptGenerator.generate(this._currentMode, this._selectedFiles, prompt, activeTaskGroup, recentFiles);
        const recentContext = historyContext.slice(-20);

        const messages: ConversationMessage[] = [
            { role: 'system', content: systemPrompt },
            ...recentContext,
            { role: 'user', content: prompt } // Using the prompt as the user input equivalent
        ];

        // 3. Run Agent Loop
        try {
            await this.runAgentLoop(messages, this._view.webview);
            return true; // If we get here without throwing, we consider it a success (tools executed)
        } catch (e) {
            console.error('Agent loop failed:', e);
            return false;
        }
    }

    /**
     * Execute tool directly without confirmation dialog (already handled by webview)
     */
    private async _executeToolDirect(command: string, args: any): Promise<string> {
        const tool = this._toolManager.getTool(command);
        if (!tool) {
            return `Error: Tool '${command}' not found`;
        }

        try {
            return await tool.execute(args);
        } catch (error) {
            return `Error executing ${command}: ${error}`;
        }
    }
}
