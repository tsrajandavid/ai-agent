import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { LLMService } from '../llm/llm-service';
import { ProjectIndexer } from '../services/project-indexer';
import { SystemPromptGenerator, AgentMode } from '../agent/system-prompt';
import { ToolManager } from '../tools/tool-manager';

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

const MAX_TOOL_ITERATIONS = 10; // Prevent infinite loops
const CHAT_HISTORY_KEY = 'ai-agent.chatHistory';

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-agent.chatView';
    private _view?: vscode.WebviewView;
    private _currentMode: AgentMode = 'PLAN';
    private _conversationHistory: ConversationMessage[] = [];
    private _selectedFiles: Record<string, string> = {};
    private _chatHistory: ChatMessage[] = [];
    private _pendingApproval: PendingApproval | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _llmService: LLMService,
        private readonly _projectIndexer: ProjectIndexer | undefined,
        private readonly _toolManager: ToolManager,
        private readonly _ensureToolsRegistered: () => boolean
    ) { }

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

        // Load and send chat history
        this._loadChatHistory();
        setTimeout(() => {
            webviewView.webview.postMessage({
                command: 'restore-history',
                messages: this._chatHistory
            });
        }, 500);

        // Send initial File List
        if (this._projectIndexer) {
            this._projectIndexer.scanFiles().then(state => {
                webviewView.webview.postMessage({
                    command: 'update-file-list',
                    files: state.files.map(f => f.path)
                });
            });
        }
    }

    private _loadChatHistory() {
        try {
            const stored = this._context.globalState.get<ChatMessage[]>(CHAT_HISTORY_KEY);
            if (stored && Array.isArray(stored)) {
                this._chatHistory = stored;
                console.log(`[AI Agent] Loaded ${stored.length} messages from history`);
            }
        } catch (e) {
            console.error('[AI Agent] Failed to load chat history:', e);
        }
    }

    private _saveChatHistory() {
        try {
            // Keep last 100 messages
            const toSave = this._chatHistory.slice(-100);
            this._context.globalState.update(CHAT_HISTORY_KEY, toSave);
        } catch (e) {
            console.error('[AI Agent] Failed to save chat history:', e);
        }
    }

    private _addToHistory(msg: ChatMessage) {
        this._chatHistory.push({ ...msg, timestamp: Date.now() });
        this._saveChatHistory();
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
                <title>AI Agent</title>
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
            (message: WebviewMessage) => {
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
                        this._chatHistory = [];
                        this._conversationHistory = [];
                        this._saveChatHistory();
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

            // Generate system prompt
            const promptGenerator = new SystemPromptGenerator(projectState);
            const systemPrompt = promptGenerator.generate(this._currentMode, this._selectedFiles);

            // Build messages for LLM
            const messages: ConversationMessage[] = [
                { role: 'system', content: systemPrompt },
                ...this._conversationHistory,
                { role: 'user', content: text }
            ];

            // Add user message to history
            this._conversationHistory.push({ role: 'user', content: text });

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

            console.log('[AI Agent] LLM response:', fullResponse.slice(0, 200) + '...');

            // Parse for tool calls
            const toolCall = this._toolManager.parseCommand(fullResponse);

            if (toolCall) {
                // Found a tool call - execute it
                console.log('[AI Agent] Tool call detected:', toolCall.command);

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

            // No tool call - this is the final response
            console.log('[AI Agent] No tool call, final response');

            // Add to conversation history
            this._conversationHistory.push({ role: 'assistant', content: fullResponse });

            // Trim history if too long
            if (this._conversationHistory.length > 20) {
                this._conversationHistory = this._conversationHistory.slice(-16);
            }

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
                    this._conversationHistory = [];
                    this._llmService.resetContext();
                    return;

                case '/help':
                    const helpMessage = `### Available Commands
- \`/add <path>\` - Add file to context
- \`/remove <path>\` - Remove file from context
- \`/context\` - List files in context
- \`/clear\` - Clear chat history
- \`/reset\` - Reset everything
- \`/help\` - Show this help`;
                    webview.postMessage({ command: 'response-complete', text: helpMessage, role: 'system' });
                    return;

                case '/reset':
                    this._selectedFiles = {};
                    this._conversationHistory = [];
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
