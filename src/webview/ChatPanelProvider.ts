import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { LLMService } from '../llm/llm-service';
import { ProjectIndexer } from '../services/project-indexer';
import { SystemPromptGenerator, AgentMode } from '../agent/system-prompt';
import { ToolManager } from '../tools/tool-manager';
import { ReadFileTool, ListDirTool, WriteFileTool } from '../tools/file-tools';

interface WebviewMessage {
    command: string;
    text: string;
    [key: string]: any;
}

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-agent.chatView';
    private _view?: vscode.WebviewView;
    private _currentMode: AgentMode = 'PLAN';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _llmService: LLMService,
        private readonly _projectIndexer: ProjectIndexer | undefined,
        private readonly _toolManager: ToolManager
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
                        this.handleHelloCommand(text, webview);
                        return;
                    case "setMode":
                        this._currentMode = text as AgentMode;
                        vscode.window.showInformationMessage(`Switched to ${text} mode`);
                        return;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }

    private async handleHelloCommand(text: string, webview: vscode.Webview) {
        // Echo user message
        webview.postMessage({
            command: "response",
            text: text,
            role: 'user'
        });

        // 1. Get latest project state
        let projectState: any = { files: [], frameworks: [] };
        if (this._projectIndexer) {
            projectState = await this._projectIndexer.scanFiles();
        }

        // 2. Generate System Prompt
        const promptGenerator = new SystemPromptGenerator(projectState);
        const systemPrompt = promptGenerator.generate(this._currentMode);

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
        ] as any;

        try {
            let fullResponse = "";
            await this._llmService.sendRequest(messages, (chunk) => {
                fullResponse += chunk;
                webview.postMessage({
                    command: "stream-chunk",
                    chunk: chunk
                });
            });

            webview.postMessage({
                command: "response-complete",
                text: fullResponse
            });

            // 3. Tool Execution Logic
            const toolCommand = this._toolManager.parseCommand(fullResponse);
            if (toolCommand) {
                const toolOutput = await this._toolManager.executeTool(toolCommand.command, toolCommand.args);

                // Send tool output to Webview
                webview.postMessage({
                    command: "response",
                    text: `🛠️ **Tool Output (${toolCommand.command})**:\n\`\`\`\n${toolOutput}\n\`\`\``,
                    role: 'system'
                });

                // TODO: In a real agent loop, we would feed this back to the LLM
            }

        } catch (error) {
            vscode.window.showErrorMessage(`LLM Error: ${error}`);
            webview.postMessage({
                command: "error",
                text: `Error: ${error}`
            });
        }
    }
}
