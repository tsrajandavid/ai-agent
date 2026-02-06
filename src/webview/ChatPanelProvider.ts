import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { LLMService } from '../llm/llm-service';
import { ProjectIndexer } from '../services/project-indexer';
import { SystemPromptGenerator, AgentMode } from '../agent/system-prompt';
import { ToolManager } from '../tools/tool-manager';
import { TaskGroupManager } from '../agent/task-group-manager';

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

    // Multi-chat state
    private _conversations: Conversation[] = [];
    private _activeConversationId: string = '';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _llmService: LLMService,
        private readonly _projectIndexer: ProjectIndexer | undefined,
        private readonly _toolManager: ToolManager,
        private readonly _taskGroupManager: TaskGroupManager | undefined,
        private readonly _ensureToolsRegistered: () => boolean
    ) { }

    // ... resolveWebviewView (remains mostly same, but calls different load method)

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

    private _loadConversations() {
        try {
            // Check for new storage format
            const storedConversations = this._context.globalState.get<Conversation[]>(CONVERSATIONS_KEY);

            if (storedConversations && Array.isArray(storedConversations) && storedConversations.length > 0) {
                this._conversations = storedConversations;
                // Set active to most recent
                this._conversations.sort((a, b) => b.timestamp - a.timestamp);
                this._activeConversationId = this._conversations[0].id;
            } else {
                // Migration path: Check for old history
                const oldHistory = this._context.globalState.get<ChatMessage[]>(OLD_CHAT_HISTORY_KEY);
                if (oldHistory && Array.isArray(oldHistory) && oldHistory.length > 0) {
                    console.log('[AI Agent] Migrating old history to new conversation format');
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
                    this._createNewChat();
                }
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

    private _saveConversations() {
        try {
            this._context.globalState.update(CONVERSATIONS_KEY, this._conversations);
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
                        const aborted = this._llmService.abort();
                        if (aborted) {
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

            // Generate system prompt with user query for context pruning
            const systemPrompt = promptGenerator.generate(this._currentMode, this._selectedFiles, text);

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
            await this.runAgentLoop(messages, webview);

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
    private async runAgentLoop(messages: ConversationMessage[], webview: vscode.Webview) {
        let iterations = 0;

        while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;
            console.log(`[AI Agent] Loop iteration ${iterations}`);

            // Call LLM
            let fullResponse = '';
            await this._llmService.sendRequest(messages as any, (chunk) => {
                fullResponse += chunk;
                webview.postMessage({ command: "stream-chunk", chunk });
            });

            console.log('[AI Agent] LLM response length:', fullResponse.length);
            console.log('[AI Agent] LLM response preview:', fullResponse.slice(0, 500));

            // Parse for tool calls
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
        const [command, ...args] = text.split(' ');
        const argText = args.join(' ');

        try {
            switch (command.toLowerCase()) {
                case '/clear':
                    webview.postMessage({ command: 'clear-chat' });
                    if (this._activeChat) {
                        this._activeChat.messages = [];
                        this._saveConversations();
                    }
                    this._llmService.resetContext();
                    return;

                case '/help':
                    const helpMessage = `### Available Commands

**Git Commands:**
- \`/commit [message]\` - Commit changes (AI generates message if not provided)
- \`/diff\` - Show uncommitted changes
- \`/status\` - Show git status
- \`/log\` - Show recent commits

**Project Commands:**
- \`/test\` - Run tests
- \`/build\` - Run build
- \`/run <cmd>\` - Run shell command

**Context Commands:**
- \`/add <path>\` - Add file to context
- \`/remove <path>\` - Remove file from context
- \`/context\` - List files in context

**Session Commands:**
- \`/clear\` - Clear chat history
- \`/reset\` - Reset everything
- \`/help\` - Show this help`;
                    webview.postMessage({ command: 'response-complete', text: helpMessage, role: 'system' });
                    return;

                case '/reset':
                    this._selectedFiles = {};
                    if (this._activeChat) {
                        this._activeChat.messages = [];
                        this._saveConversations();
                    }
                    this._llmService.resetContext();
                    if (this._projectIndexer) {
                        await this._projectIndexer.scanFiles();
                    }
                    webview.postMessage({ command: 'response-complete', text: '✅ Reset complete', role: 'system' });
                    return;

                case '/add':
                    if (!argText) {
                        webview.postMessage({ command: 'response-complete', text: '❌ Please specify a file path', role: 'system' });
                        return;
                    }
                    await this.addFileToContext(argText, webview);
                    return;

                case '/remove':
                    if (!argText) {
                        webview.postMessage({ command: 'response-complete', text: '❌ Please specify a file path', role: 'system' });
                        return;
                    }
                    if (this._selectedFiles[argText]) {
                        delete this._selectedFiles[argText];
                        webview.postMessage({ command: 'response-complete', text: `🗑️ Removed **${argText}** from context`, role: 'system' });
                    } else {
                        webview.postMessage({ command: 'response-complete', text: `❌ File not in context: ${argText}`, role: 'system' });
                    }
                    return;

                case '/context':
                    const files = Object.keys(this._selectedFiles);
                    if (files.length === 0) {
                        webview.postMessage({ command: 'response-complete', text: '📂 No files in context', role: 'system' });
                    } else {
                        webview.postMessage({
                            command: 'response-complete',
                            text: `### 📂 Active Context\n${files.map(f => `- ${f}`).join('\n')}`,
                            role: 'system'
                        });
                    }
                    return;

                // Git Commands
                case '/commit':
                    await this.handleCommit(argText, webview);
                    return;

                case '/diff':
                    await this.handleGitCommand('git_diff', 'Git Diff', webview);
                    return;

                case '/status':
                    await this.handleGitCommand('git_status', 'Git Status', webview);
                    return;

                case '/log':
                    await this.handleGitCommand('git_log', 'Git Log', webview);
                    return;

                // Project Commands
                case '/test':
                    await this.handleRunCommand('npm test', 'Running Tests', webview);
                    return;

                case '/build':
                    await this.handleRunCommand('npm run build', 'Building Project', webview);
                    return;

                case '/run':
                    if (!argText) {
                        webview.postMessage({ command: 'response-complete', text: '❌ Please specify a command to run', role: 'system' });
                        return;
                    }
                    await this.handleRunCommand(argText, `Running: ${argText}`, webview);
                    return;

                default:
                    webview.postMessage({
                        command: 'response-complete',
                        text: `❌ Unknown command: ${command}\nType \`/help\` for available commands`,
                        role: 'system'
                    });
                    return;
            }
        } catch (error) {
            console.error('[Slash Command Error]', error);
            webview.postMessage({
                command: 'response-complete',
                text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
                role: 'system'
            });
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

    /**
     * Handle /commit command - creates a git commit
     */
    private async handleCommit(message: string, webview: vscode.Webview) {
        if (!this._ensureToolsRegistered()) {
            webview.postMessage({ command: 'response-complete', text: '❌ No workspace folder open', role: 'system' });
            return;
        }

        try {
            // First get the diff to show what's being committed
            const diffResult = await this._executeToolDirect('git_diff', {});

            if (diffResult.includes('No changes') || diffResult.includes('Error')) {
                webview.postMessage({ command: 'response-complete', text: '📭 No changes to commit', role: 'system' });
                return;
            }

            // If no message provided, ask AI to generate one
            let commitMessage = message;
            if (!commitMessage) {
                webview.postMessage({ command: 'response-complete', text: '🤖 Generating commit message...', role: 'system' });

                // Use LLM to generate commit message
                const prompt = `Based on this git diff, generate a concise commit message (one line, max 72 chars). Only output the commit message, nothing else:\n\n${diffResult.slice(0, 2000)}`;

                let generatedMessage = '';
                await this._llmService.sendRequest(
                    [{ role: 'user', content: prompt }] as any,
                    (chunk) => { generatedMessage += chunk; }
                );

                commitMessage = generatedMessage.trim().replace(/^["']|["']$/g, '').split('\n')[0];
            }

            // Show what will be committed
            webview.postMessage({
                command: 'response-complete',
                text: `### 📝 Commit Preview\n\n**Message:** ${commitMessage}\n\n**Changes:**\n\`\`\`diff\n${diffResult.slice(0, 1000)}${diffResult.length > 1000 ? '\n...(truncated)' : ''}\n\`\`\`\n\n*Run \`git commit -m "${commitMessage}"\` to commit*`,
                role: 'system'
            });

        } catch (error) {
            webview.postMessage({
                command: 'response-complete',
                text: `❌ Commit failed: ${error instanceof Error ? error.message : String(error)}`,
                role: 'system'
            });
        }
    }

    /**
     * Handle git commands (/diff, /status, /log)
     */
    private async handleGitCommand(toolName: string, title: string, webview: vscode.Webview) {
        if (!this._ensureToolsRegistered()) {
            webview.postMessage({ command: 'response-complete', text: '❌ No workspace folder open', role: 'system' });
            return;
        }

        try {
            webview.postMessage({ command: 'response-complete', text: `⏳ ${title}...`, role: 'system' });

            const result = await this._executeToolDirect(toolName, {});

            webview.postMessage({
                command: 'response-complete',
                text: `### ${title}\n\n\`\`\`\n${result}\n\`\`\``,
                role: 'system'
            });
        } catch (error) {
            webview.postMessage({
                command: 'response-complete',
                text: `❌ ${title} failed: ${error instanceof Error ? error.message : String(error)}`,
                role: 'system'
            });
        }
    }

    /**
     * Handle /run, /test, /build commands
     */
    private async handleRunCommand(cmd: string, title: string, webview: vscode.Webview) {
        if (!this._ensureToolsRegistered()) {
            webview.postMessage({ command: 'response-complete', text: '❌ No workspace folder open', role: 'system' });
            return;
        }

        try {
            webview.postMessage({ command: 'response-complete', text: `⏳ ${title}...`, role: 'system' });

            const result = await this._executeToolDirect('run_command', { command: cmd });

            // Determine if command succeeded or failed based on output
            const isError = result.toLowerCase().includes('error') || result.toLowerCase().includes('failed');
            const icon = isError ? '❌' : '✅';

            webview.postMessage({
                command: 'response-complete',
                text: `### ${icon} ${title}\n\n\`\`\`\n${result}\n\`\`\``,
                role: 'system'
            });
        } catch (error) {
            webview.postMessage({
                command: 'response-complete',
                text: `❌ ${title} failed: ${error instanceof Error ? error.message : String(error)}`,
                role: 'system'
            });
        }
    }

    private async addFileToContext(filePath: string, webview: vscode.Webview) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                webview.postMessage({ command: 'response-complete', text: '❌ No workspace open', role: 'system' });
                return;
            }

            const rootPath = workspaceFolders[0].uri;
            const fileUri = vscode.Uri.joinPath(rootPath, filePath);

            try {
                const content = await vscode.workspace.fs.readFile(fileUri);
                const textContent = new TextDecoder().decode(content);
                this._selectedFiles[filePath] = textContent;

                const lines = textContent.split('\n').length;
                webview.postMessage({
                    command: 'response-complete',
                    text: `✅ Added **${filePath}** to context (${lines} lines)`,
                    role: 'system'
                });
            } catch (fsError) {
                webview.postMessage({
                    command: 'response-complete',
                    text: `❌ File not found: ${filePath}`,
                    role: 'system'
                });
            }
        } catch (error) {
            console.error(error);
            webview.postMessage({ command: 'response-complete', text: '❌ Error adding file', role: 'system' });
        }
    }
}
