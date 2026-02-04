# VS Code Extension Development - Complete Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Extension Host (Node.js)](#extension-host-nodejs)
3. [Webview (React)](#webview-react)
4. [Communication Pattern](#communication-pattern)
5. [VS Code API Deep Dive](#vs-code-api-deep-dive)
6. [Extension Lifecycle](#extension-lifecycle)
7. [Package.json Manifest](#packagejson-manifest)
8. [Project Setup](#project-setup)
9. [Build System](#build-system)
10. [Debugging](#debugging)
11. [Best Practices](#best-practices)

---

## Architecture Overview

### Two Runtime Environments

VS Code extensions run in **two separate environments** that communicate via message passing:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VS CODE                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                    EXTENSION HOST                               │    │
│   │                    (Node.js Process)                            │    │
│   │                                                                 │    │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │    │
│   │   │ extension.ts│  │  Services   │  │   Tools     │           │    │
│   │   │ (entry)     │  │ (git,file)  │  │ (handlers)  │           │    │
│   │   └─────────────┘  └─────────────┘  └─────────────┘           │    │
│   │                                                                 │    │
│   │   Full Access To:                                               │    │
│   │   ✓ File System (read, write, delete)                          │    │
│   │   ✓ Terminal (create, execute commands)                         │    │
│   │   ✓ Git (via simple-git or commands)                           │    │
│   │   ✓ VS Code API (editors, diagnostics, etc.)                   │    │
│   │   ✓ Network (HTTP requests to LLM APIs)                        │    │
│   │   ✓ Child Processes (spawn commands)                           │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              │ postMessage (async)                       │
│                              │                                           │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                       WEBVIEW                                   │    │
│   │                    (Browser Sandbox)                            │    │
│   │                                                                 │    │
│   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │    │
│   │   │   App.tsx   │  │ Components  │  │   Hooks     │           │    │
│   │   │   (React)   │  │ (Chat, UI)  │  │ (state)     │           │    │
│   │   └─────────────┘  └─────────────┘  └─────────────┘           │    │
│   │                                                                 │    │
│   │   Limited Access:                                               │    │
│   │   ✓ DOM manipulation                                           │    │
│   │   ✓ React state management                                     │    │
│   │   ✓ CSS styling                                                │    │
│   │   ✗ NO file system access                                      │    │
│   │   ✗ NO direct VS Code API                                      │    │
│   │   ✗ NO network requests (by default)                           │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Two Environments?

| Reason | Explanation |
|--------|-------------|
| **Security** | Webviews are sandboxed to prevent malicious extensions |
| **Performance** | UI runs separately, doesn't block extension |
| **Web Standards** | Webview uses standard HTML/CSS/JS |
| **Flexibility** | Use any UI framework (React, Vue, Svelte) |

---

## Extension Host (Node.js)

### What Runs Here?

Everything that needs system access:
- File operations
- Terminal commands
- Git operations
- LLM API calls
- VS Code API interactions

### Entry Point: extension.ts

```typescript
// src/extension.ts

import * as vscode from 'vscode';

// Called when extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated!');
    
    // Register commands
    const disposable = vscode.commands.registerCommand(
        'ai-agent.openChat',
        () => {
            // Open chat panel
        }
    );
    
    // Add to subscriptions (cleanup on deactivate)
    context.subscriptions.push(disposable);
}

// Called when extension is deactivated
export function deactivate() {
    console.log('Extension deactivated!');
}
```

### Activation Events

Extension activates when specific events occur:

```json
// package.json
{
    "activationEvents": [
        "onCommand:ai-agent.openChat",
        "onView:ai-agent.chatView",
        "onStartupFinished",
        "workspaceContains:**/package.json"
    ]
}
```

| Event | When Extension Activates |
|-------|-------------------------|
| `onCommand:X` | When command X is executed |
| `onView:X` | When view X becomes visible |
| `onStartupFinished` | After VS Code fully starts |
| `workspaceContains:X` | When workspace has file matching X |
| `*` | Always (not recommended) |

### Extension Context

The `context` object provides:

```typescript
export function activate(context: vscode.ExtensionContext) {
    // Storage paths
    context.extensionPath        // Extension install location
    context.globalStoragePath    // Global persistent storage
    context.workspaceState       // Workspace-specific storage
    context.globalState          // Global storage
    
    // Secrets (for API keys)
    context.secrets.store('api-key', 'sk-xxx');
    context.secrets.get('api-key');
    
    // Subscriptions (auto-cleanup)
    context.subscriptions.push(disposable);
}
```

---

## Webview (React)

### What Is a Webview?

A webview is an **iframe-like panel** that renders HTML/CSS/JS inside VS Code. Think of it as a mini browser window.

### Creating a Webview Provider

```typescript
// src/webview/ChatPanelProvider.ts

import * as vscode from 'vscode';

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-agent.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) {}

    // Called when webview becomes visible
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        // Configure webview
        webviewView.webview.options = {
            enableScripts: true,  // Allow JavaScript
            localResourceRoots: [this._extensionUri]  // Allow local files
        };

        // Set HTML content
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            message => this._handleMessage(message),
            undefined,
            this._context.subscriptions
        );
    }

    // Generate HTML with React app
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get URIs for scripts and styles
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'index.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'index.css')
        );

        // Nonce for security (prevents inline script injection)
        const nonce = this._getNonce();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="
                    default-src 'none';
                    style-src ${webview.cspSource} 'unsafe-inline';
                    script-src 'nonce-${nonce}';
                    font-src ${webview.cspSource};
                ">
                <link href="${styleUri}" rel="stylesheet">
                <title>AI Agent</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    // Handle messages from React
    private _handleMessage(message: any) {
        switch (message.type) {
            case 'sendMessage':
                // Process user message
                this._processUserMessage(message.text);
                break;
            case 'getSettings':
                // Return settings
                this._sendSettings();
                break;
        }
    }

    // Send message TO webview
    public postMessage(message: any) {
        this._view?.webview.postMessage(message);
    }

    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
```

### Registering the Webview

```typescript
// src/extension.ts

export function activate(context: vscode.ExtensionContext) {
    // Create provider
    const chatProvider = new ChatPanelProvider(
        context.extensionUri,
        context
    );

    // Register as sidebar view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatPanelProvider.viewType,
            chatProvider
        )
    );
}
```

---

## Communication Pattern

### Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MESSAGE FLOW                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   WEBVIEW (React)                      EXTENSION HOST (Node.js)         │
│   ───────────────                      ────────────────────────         │
│                                                                          │
│   User clicks "Send"                                                     │
│         │                                                                │
│         ▼                                                                │
│   ┌─────────────────┐                                                   │
│   │ vscode.postMessage({                                                │
│   │   type: 'sendMessage',             ──────────────────────►          │
│   │   text: 'Fix the bug'                                               │
│   │ })                                                                  │
│   └─────────────────┘                  ┌─────────────────────┐          │
│                                        │ onDidReceiveMessage  │          │
│                                        │ handler processes    │          │
│                                        │ the message          │          │
│                                        └──────────┬──────────┘          │
│                                                   │                      │
│                                                   ▼                      │
│                                        ┌─────────────────────┐          │
│                                        │ Call LLM API        │          │
│                                        │ Execute tools       │          │
│                                        │ Get response        │          │
│                                        └──────────┬──────────┘          │
│                                                   │                      │
│   ┌─────────────────┐                            │                      │
│   │ window.addEventListener(                      │                      │
│   │   'message',           ◄──────────────────────                      │
│   │   handler                                                           │
│   │ )                      webview.postMessage({                        │
│   └─────────────────┘        type: 'response',                          │
│         │                    text: 'Here is the fix...'                 │
│         ▼                  })                                           │
│   Update React state                                                    │
│   Render response                                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Extension Side (Sending & Receiving)

```typescript
// src/webview/ChatPanelProvider.ts

class ChatPanelProvider {
    // RECEIVE from webview
    webviewView.webview.onDidReceiveMessage(message => {
        switch (message.type) {
            case 'sendMessage':
                this.handleUserMessage(message.text);
                break;
            case 'cancelRequest':
                this.cancelCurrentRequest();
                break;
            case 'confirmAction':
                this.executeConfirmedAction(message.actionId);
                break;
        }
    });

    // SEND to webview
    public sendResponse(text: string) {
        this._view?.webview.postMessage({
            type: 'response',
            text: text
        });
    }

    public sendStreamChunk(chunk: string) {
        this._view?.webview.postMessage({
            type: 'stream',
            chunk: chunk
        });
    }

    public requestConfirmation(action: string, details: any) {
        this._view?.webview.postMessage({
            type: 'confirmationRequired',
            action: action,
            details: details
        });
    }
}
```

### Webview Side (React)

```typescript
// webview-ui/src/hooks/useVSCode.ts

// Acquire VS Code API (only call once!)
const vscode = acquireVsCodeApi();

export function useVSCode() {
    // Send message TO extension
    const sendMessage = (type: string, data?: any) => {
        vscode.postMessage({ type, ...data });
    };

    // Listen for messages FROM extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            
            switch (message.type) {
                case 'response':
                    // Handle complete response
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: message.text
                    }]);
                    break;
                    
                case 'stream':
                    // Handle streaming chunk
                    setCurrentResponse(prev => prev + message.chunk);
                    break;
                    
                case 'confirmationRequired':
                    // Show confirmation dialog
                    setConfirmation(message);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return { sendMessage };
}
```

```typescript
// webview-ui/src/App.tsx

import { useVSCode } from './hooks/useVSCode';

function App() {
    const { sendMessage } = useVSCode();
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);

    const handleSend = () => {
        // Add user message to UI
        setMessages(prev => [...prev, {
            role: 'user',
            content: input
        }]);
        
        // Send to extension
        sendMessage('sendMessage', { text: input });
        
        setInput('');
    };

    return (
        <div className="chat-container">
            <MessageList messages={messages} />
            <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend}>Send</button>
        </div>
    );
}
```

### Message Types Reference

| Direction | Type | Purpose |
|-----------|------|---------|
| Webview → Extension | `sendMessage` | User sends chat message |
| Webview → Extension | `cancelRequest` | User cancels current operation |
| Webview → Extension | `confirmAction` | User approves pending action |
| Webview → Extension | `rejectAction` | User rejects pending action |
| Webview → Extension | `getSettings` | Request current settings |
| Webview → Extension | `saveSettings` | Save new settings |
| Extension → Webview | `response` | Complete LLM response |
| Extension → Webview | `stream` | Streaming chunk |
| Extension → Webview | `toolCall` | Tool is being executed |
| Extension → Webview | `toolResult` | Tool execution result |
| Extension → Webview | `confirmationRequired` | Needs user approval |
| Extension → Webview | `error` | Error occurred |
| Extension → Webview | `settings` | Current settings data |

---

## VS Code API Deep Dive

### Workspace API

```typescript
import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════
// FILE OPERATIONS
// ═══════════════════════════════════════════════════════════

// Get workspace folder
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
const rootPath = workspaceFolder?.uri.fsPath;

// Read file
const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, 'src/index.ts');
const fileContent = await vscode.workspace.fs.readFile(fileUri);
const text = new TextDecoder().decode(fileContent);

// Write file
const newContent = Buffer.from('console.log("Hello")');
await vscode.workspace.fs.writeFile(fileUri, newContent);

// Delete file
await vscode.workspace.fs.delete(fileUri);

// Create directory
await vscode.workspace.fs.createDirectory(dirUri);

// List directory
const entries = await vscode.workspace.fs.readDirectory(dirUri);
// Returns: [['file.ts', FileType.File], ['src', FileType.Directory]]

// Check if file exists
try {
    await vscode.workspace.fs.stat(fileUri);
    // File exists
} catch {
    // File doesn't exist
}

// ═══════════════════════════════════════════════════════════
// FILE WATCHING
// ═══════════════════════════════════════════════════════════

// Watch for file changes
const watcher = vscode.workspace.createFileSystemWatcher('**/*.ts');

watcher.onDidCreate(uri => console.log('Created:', uri.fsPath));
watcher.onDidChange(uri => console.log('Changed:', uri.fsPath));
watcher.onDidDelete(uri => console.log('Deleted:', uri.fsPath));

// Don't forget to dispose
context.subscriptions.push(watcher);

// ═══════════════════════════════════════════════════════════
// FIND FILES
// ═══════════════════════════════════════════════════════════

// Find files matching pattern
const files = await vscode.workspace.findFiles(
    '**/*.ts',           // Include pattern
    '**/node_modules/**' // Exclude pattern
);

// Search in files
const results = await vscode.workspace.findTextInFiles(
    { pattern: 'TODO' },
    { include: '**/*.ts' }
);
```

### Window API

```typescript
import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════
// MESSAGES & NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

// Information message
vscode.window.showInformationMessage('Operation completed!');

// Warning message
vscode.window.showWarningMessage('Be careful!');

// Error message
vscode.window.showErrorMessage('Something went wrong!');

// Message with actions
const selection = await vscode.window.showInformationMessage(
    'Do you want to proceed?',
    'Yes', 'No', 'Cancel'
);
if (selection === 'Yes') {
    // User clicked Yes
}

// ═══════════════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════════════

// Simple input
const name = await vscode.window.showInputBox({
    prompt: 'Enter your name',
    placeHolder: 'John Doe',
    validateInput: (value) => {
        if (!value) return 'Name is required';
        return null; // Valid
    }
});

// Quick pick (dropdown)
const choice = await vscode.window.showQuickPick(
    ['Option 1', 'Option 2', 'Option 3'],
    { placeHolder: 'Select an option' }
);

// Quick pick with details
const models = await vscode.window.showQuickPick([
    { label: 'GPT-4', description: 'Most capable', detail: '$0.03/1K tokens' },
    { label: 'GPT-3.5', description: 'Fast & cheap', detail: '$0.002/1K tokens' }
]);

// ═══════════════════════════════════════════════════════════
// ACTIVE EDITOR
// ═══════════════════════════════════════════════════════════

// Get active editor
const editor = vscode.window.activeTextEditor;
if (editor) {
    // Current file path
    const filePath = editor.document.uri.fsPath;
    
    // Current file content
    const content = editor.document.getText();
    
    // Current selection
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    
    // Current language
    const language = editor.document.languageId; // 'typescript', 'python', etc.
    
    // Insert text at cursor
    editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, 'Hello World');
    });
    
    // Replace selection
    editor.edit(editBuilder => {
        editBuilder.replace(editor.selection, 'New Text');
    });
}

// Listen for editor changes
vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
        console.log('Switched to:', editor.document.uri.fsPath);
    }
});

// ═══════════════════════════════════════════════════════════
// PROGRESS
// ═══════════════════════════════════════════════════════════

// Show progress notification
await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Processing...',
    cancellable: true
}, async (progress, token) => {
    // Check if cancelled
    token.onCancellationRequested(() => {
        console.log('User cancelled');
    });
    
    progress.report({ increment: 0, message: 'Starting...' });
    
    // Do work
    await doStep1();
    progress.report({ increment: 50, message: 'Halfway done...' });
    
    await doStep2();
    progress.report({ increment: 100, message: 'Complete!' });
});
```

### Terminal API

```typescript
import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════
// CREATE & USE TERMINAL
// ═══════════════════════════════════════════════════════════

// Create new terminal
const terminal = vscode.window.createTerminal({
    name: 'AI Agent',
    cwd: workspaceFolder?.uri.fsPath
});

// Show terminal
terminal.show();

// Send command
terminal.sendText('npm install');

// Send command without pressing Enter
terminal.sendText('npm ', false);

// ═══════════════════════════════════════════════════════════
// CAPTURE OUTPUT (VS Code 1.93+)
// ═══════════════════════════════════════════════════════════

// Using shell integration (recommended for capturing output)
const execution = terminal.shellIntegration?.executeCommand('npm test');

if (execution) {
    // Wait for command to complete
    const stream = execution.read();
    let output = '';
    
    for await (const chunk of stream) {
        output += chunk;
    }
    
    console.log('Command output:', output);
}

// Alternative: Use child_process for output capture
import * as cp from 'child_process';

function runCommand(command: string, cwd: string): Promise<{stdout: string, stderr: string}> {
    return new Promise((resolve, reject) => {
        cp.exec(command, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
            if (error && error.killed) {
                reject(new Error('Command timed out'));
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Usage
const { stdout, stderr } = await runCommand('npm test', rootPath);
```

### Commands API

```typescript
import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════
// REGISTER COMMANDS
// ═══════════════════════════════════════════════════════════

// Simple command
const disposable = vscode.commands.registerCommand(
    'ai-agent.openChat',
    () => {
        // Command logic
        vscode.window.showInformationMessage('Chat opened!');
    }
);
context.subscriptions.push(disposable);

// Command with arguments
vscode.commands.registerCommand(
    'ai-agent.askAboutFile',
    (uri: vscode.Uri) => {
        console.log('Asked about:', uri.fsPath);
    }
);

// ═══════════════════════════════════════════════════════════
// EXECUTE COMMANDS
// ═══════════════════════════════════════════════════════════

// Execute your own command
await vscode.commands.executeCommand('ai-agent.openChat');

// Execute built-in commands
await vscode.commands.executeCommand('workbench.action.files.save');
await vscode.commands.executeCommand('editor.action.formatDocument');
await vscode.commands.executeCommand('workbench.action.terminal.toggleTerminal');

// Open file
await vscode.commands.executeCommand('vscode.open', fileUri);

// Show diff
await vscode.commands.executeCommand('vscode.diff', 
    originalUri, 
    modifiedUri, 
    'Original ↔ Modified'
);
```

### Diagnostics API (Problems Panel)

```typescript
import * as vscode from 'vscode';

// ═══════════════════════════════════════════════════════════
// READ DIAGNOSTICS (Problems)
// ═══════════════════════════════════════════════════════════

// Get all diagnostics for a file
const uri = vscode.Uri.file('/path/to/file.ts');
const diagnostics = vscode.languages.getDiagnostics(uri);

for (const diagnostic of diagnostics) {
    console.log({
        message: diagnostic.message,
        severity: diagnostic.severity, // Error, Warning, Info, Hint
        line: diagnostic.range.start.line,
        source: diagnostic.source // 'typescript', 'eslint', etc.
    });
}

// Get all diagnostics in workspace
const allDiagnostics = vscode.languages.getDiagnostics();
// Returns: [Uri, Diagnostic[]][]

// ═══════════════════════════════════════════════════════════
// CREATE DIAGNOSTICS (Show Problems)
// ═══════════════════════════════════════════════════════════

// Create diagnostic collection
const collection = vscode.languages.createDiagnosticCollection('ai-agent');
context.subscriptions.push(collection);

// Add diagnostics
const diagnostic = new vscode.Diagnostic(
    new vscode.Range(10, 0, 10, 50), // Line 10, columns 0-50
    'Potential security issue: SQL injection',
    vscode.DiagnosticSeverity.Warning
);
diagnostic.source = 'AI Agent';
diagnostic.code = 'security-001';

collection.set(uri, [diagnostic]);

// Clear diagnostics
collection.clear();
```

---

## Extension Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXTENSION LIFECYCLE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   VS Code Starts                                                         │
│         │                                                                │
│         ▼                                                                │
│   ┌─────────────────┐                                                   │
│   │ Load package.json│                                                   │
│   │ (not activated) │                                                   │
│   └────────┬────────┘                                                   │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────┐     ┌─────────────────────────────────┐          │
│   │ Activation Event│────►│ onCommand:ai-agent.openChat     │          │
│   │ Triggered?      │     │ onView:ai-agent.chatView        │          │
│   └────────┬────────┘     │ onStartupFinished               │          │
│            │              └─────────────────────────────────┘          │
│            │ Yes                                                        │
│            ▼                                                             │
│   ┌─────────────────┐                                                   │
│   │ activate()      │  ◄── Your code runs here!                        │
│   │ called          │                                                   │
│   └────────┬────────┘                                                   │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────┐                                                   │
│   │ Extension       │                                                   │
│   │ Running         │  ◄── Handle commands, webviews, etc.             │
│   └────────┬────────┘                                                   │
│            │                                                             │
│            │ VS Code closes / Extension disabled                        │
│            ▼                                                             │
│   ┌─────────────────┐                                                   │
│   │ deactivate()    │  ◄── Cleanup code                                │
│   │ called          │                                                   │
│   └─────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Disposables Pattern

VS Code uses the **Disposable pattern** for cleanup:

```typescript
export function activate(context: vscode.ExtensionContext) {
    // Everything added to subscriptions is auto-disposed on deactivate
    
    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-agent.open', () => {})
    );
    
    // File watchers
    context.subscriptions.push(
        vscode.workspace.createFileSystemWatcher('**/*.ts')
    );
    
    // Webview providers
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(viewType, provider)
    );
    
    // Event listeners
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {})
    );
    
    // Custom disposables
    const myResource = createSomeResource();
    context.subscriptions.push({
        dispose: () => myResource.cleanup()
    });
}
```

---

## Package.json Manifest

The `package.json` is the **manifest** that tells VS Code about your extension:

```json
{
    "name": "ai-agent",
    "displayName": "AI Coding Agent",
    "description": "AI-powered coding assistant",
    "version": "0.0.1",
    "publisher": "your-name",
    "engines": {
        "vscode": "^1.85.0"
    },
    
    "categories": ["Programming Languages", "Machine Learning"],
    "keywords": ["ai", "agent", "copilot", "assistant"],
    
    "activationEvents": [
        "onStartupFinished"
    ],
    
    "main": "./dist/extension.js",
    
    "contributes": {
        
        "commands": [
            {
                "command": "ai-agent.openChat",
                "title": "Open AI Chat",
                "category": "AI Agent",
                "icon": "$(comment-discussion)"
            },
            {
                "command": "ai-agent.reviewCode",
                "title": "Review Code",
                "category": "AI Agent"
            }
        ],
        
        "views": {
            "ai-agent-sidebar": [
                {
                    "type": "webview",
                    "id": "ai-agent.chatView",
                    "name": "AI Chat",
                    "icon": "$(robot)",
                    "contextualTitle": "AI Agent"
                }
            ]
        },
        
        "viewsContainers": {
            "activitybar": [
                {
                    "id": "ai-agent-sidebar",
                    "title": "AI Agent",
                    "icon": "$(robot)"
                }
            ]
        },
        
        "menus": {
            "editor/context": [
                {
                    "command": "ai-agent.reviewCode",
                    "when": "editorHasSelection",
                    "group": "ai-agent"
                }
            ],
            "view/title": [
                {
                    "command": "ai-agent.openSettings",
                    "when": "view == ai-agent.chatView",
                    "group": "navigation"
                }
            ]
        },
        
        "keybindings": [
            {
                "command": "ai-agent.openChat",
                "key": "ctrl+shift+a",
                "mac": "cmd+shift+a"
            }
        ],
        
        "configuration": {
            "title": "AI Agent",
            "properties": {
                "aiAgent.apiKey": {
                    "type": "string",
                    "default": "",
                    "description": "OpenRouter API Key"
                },
                "aiAgent.model": {
                    "type": "string",
                    "default": "meta-llama/llama-3.1-8b-instruct:free",
                    "enum": [
                        "meta-llama/llama-3.1-8b-instruct:free",
                        "anthropic/claude-3-haiku",
                        "anthropic/claude-3-sonnet"
                    ],
                    "description": "Model to use"
                },
                "aiAgent.autoApproveReads": {
                    "type": "boolean",
                    "default": true,
                    "description": "Auto-approve file read operations"
                }
            }
        }
    },
    
    "scripts": {
        "vscode:prepublish": "npm run build",
        "build": "node esbuild.js --production",
        "watch": "node esbuild.js --watch",
        "lint": "eslint src --ext ts"
    },
    
    "devDependencies": {
        "@types/vscode": "^1.85.0",
        "@types/node": "^20.0.0",
        "typescript": "^5.3.0",
        "esbuild": "^0.19.0"
    },
    
    "dependencies": {
        "openai": "^4.52.0",
        "simple-git": "^3.22.0"
    }
}
```

### Contributes Breakdown

| Section | Purpose |
|---------|---------|
| `commands` | Adds commands to command palette |
| `views` | Adds sidebar panels |
| `viewsContainers` | Adds icons to activity bar |
| `menus` | Adds items to context menus |
| `keybindings` | Adds keyboard shortcuts |
| `configuration` | Adds settings |

---

## Project Setup

### Step-by-Step Setup

```bash
# 1. Create project folder
mkdir vscode-ai-agent
cd vscode-ai-agent

# 2. Initialize npm
npm init -y

# 3. Install dependencies
npm install openai simple-git fast-glob ignore

# 4. Install dev dependencies
npm install -D @types/vscode @types/node typescript esbuild

# 5. Create folder structure
mkdir -p src/{agent,tools,services,llm,webview}
mkdir -p webview-ui/src/{components,hooks}

# 6. Initialize webview React app
cd webview-ui
npm init -y
npm install react react-dom
npm install -D @types/react @types/react-dom vite @vitejs/plugin-react typescript
```

### TypeScript Configuration

```json
// tsconfig.json (extension)
{
    "compilerOptions": {
        "module": "commonjs",
        "target": "ES2022",
        "lib": ["ES2022"],
        "outDir": "dist",
        "rootDir": "src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "resolveJsonModule": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "webview-ui"]
}
```

```json
// webview-ui/tsconfig.json (React)
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": ["DOM", "DOM.Iterable", "ES2022"],
        "module": "ESNext",
        "moduleResolution": "bundler",
        "jsx": "react-jsx",
        "strict": true,
        "skipLibCheck": true
    },
    "include": ["src"]
}
```

---

## Build System

### esbuild Configuration

```javascript
// esbuild.js
const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'], // Don't bundle vscode module
        logLevel: 'info',
    });

    if (watch) {
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
```

### Vite Configuration (Webview)

```typescript
// webview-ui/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                entryFileNames: 'index.js',
                chunkFileNames: 'index.js',
                assetFileNames: 'index.[ext]'
            }
        }
    }
});
```

### NPM Scripts

```json
// package.json
{
    "scripts": {
        "build": "npm run build:extension && npm run build:webview",
        "build:extension": "node esbuild.js --production",
        "build:webview": "cd webview-ui && npm run build",
        
        "watch": "npm run watch:extension & npm run watch:webview",
        "watch:extension": "node esbuild.js --watch",
        "watch:webview": "cd webview-ui && npm run dev",
        
        "package": "vsce package",
        "lint": "eslint src --ext ts"
    }
}
```

---

## Debugging

### Launch Configuration

```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "preLaunchTask": "npm: watch"
        },
        {
            "name": "Run Extension (Production)",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "preLaunchTask": "npm: build"
        }
    ]
}
```

### Tasks Configuration

```json
// .vscode/tasks.json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "npm",
            "script": "watch",
            "isBackground": true,
            "problemMatcher": {
                "owner": "typescript",
                "pattern": "$tsc",
                "background": {
                    "activeOnStart": true,
                    "beginsPattern": "^\\[watch\\]",
                    "endsPattern": "^\\[watch\\] Build finished"
                }
            },
            "label": "npm: watch"
        },
        {
            "type": "npm",
            "script": "build",
            "label": "npm: build"
        }
    ]
}
```

### Debug Tips

```typescript
// Use console.log - appears in Debug Console
console.log('Debug:', variable);

// Use Output Channel for user-visible logs
const outputChannel = vscode.window.createOutputChannel('AI Agent');
outputChannel.appendLine('Starting operation...');
outputChannel.show();

// Debug webview: In the Extension Development Host,
// press Cmd+Shift+P > "Developer: Open Webview Developer Tools"
```

---

## Best Practices

### 1. Error Handling

```typescript
// Always wrap async operations
async function safeOperation() {
    try {
        await riskyOperation();
    } catch (error) {
        // Log for debugging
        console.error('Operation failed:', error);
        
        // Show user-friendly message
        vscode.window.showErrorMessage(
            `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}
```

### 2. Disposable Management

```typescript
// Use CompositeDisposable pattern for complex resources
class MyService implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration(() => this.reload())
        );
        this.disposables.push(
            vscode.workspace.createFileSystemWatcher('**/*.ts')
        );
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
}
```

### 3. Configuration Reading

```typescript
// Read configuration with type safety
function getConfig<T>(key: string, defaultValue: T): T {
    return vscode.workspace
        .getConfiguration('aiAgent')
        .get<T>(key, defaultValue);
}

// Watch for configuration changes
vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('aiAgent')) {
        // Reload settings
    }
});
```

### 4. Webview Security

```typescript
// Always use Content Security Policy
const csp = `
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    font-src ${webview.cspSource};
    img-src ${webview.cspSource} https: data:;
`;

// Always validate messages from webview
webview.onDidReceiveMessage(message => {
    // Validate message structure
    if (!message || typeof message.type !== 'string') {
        console.error('Invalid message:', message);
        return;
    }
    
    // Handle known message types only
    switch (message.type) {
        case 'sendMessage':
            if (typeof message.text === 'string') {
                handleSendMessage(message.text);
            }
            break;
        // ... other cases
        default:
            console.warn('Unknown message type:', message.type);
    }
});
```

### 5. Performance

```typescript
// Debounce frequent operations
function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

// Usage
const debouncedIndex = debounce(() => indexProject(), 1000);
vscode.workspace.onDidSaveTextDocument(debouncedIndex);

// Lazy initialization
class ExpensiveService {
    private _instance: SomeExpensiveResource | undefined;
    
    get instance(): SomeExpensiveResource {
        if (!this._instance) {
            this._instance = new SomeExpensiveResource();
        }
        return this._instance;
    }
}
```

---

## Quick Reference

### Common Patterns

| Task | Code |
|------|------|
| Get workspace root | `vscode.workspace.workspaceFolders?.[0]?.uri.fsPath` |
| Get active file | `vscode.window.activeTextEditor?.document.uri.fsPath` |
| Get selection | `vscode.window.activeTextEditor?.document.getText(editor.selection)` |
| Read file | `vscode.workspace.fs.readFile(uri)` |
| Write file | `vscode.workspace.fs.writeFile(uri, Buffer.from(content))` |
| Show message | `vscode.window.showInformationMessage('text')` |
| Get setting | `vscode.workspace.getConfiguration('ext').get('key')` |
| Register command | `vscode.commands.registerCommand('ext.cmd', fn)` |
| Create terminal | `vscode.window.createTerminal('name')` |
| Open file | `vscode.commands.executeCommand('vscode.open', uri)` |

### Useful VS Code Commands

| Command | Purpose |
|---------|---------|
| `vscode.open` | Open file in editor |
| `vscode.diff` | Show diff between two files |
| `workbench.action.files.save` | Save current file |
| `workbench.action.closeActiveEditor` | Close current editor |
| `workbench.action.terminal.toggleTerminal` | Toggle terminal |
| `editor.action.formatDocument` | Format document |

---

*This document serves as your complete reference for VS Code extension development.*