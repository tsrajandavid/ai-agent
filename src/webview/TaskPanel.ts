import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { TaskGroupManager } from '../agent/task-group-manager';

export class TaskPanel {
    public static currentPanel: TaskPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private taskGroupManager: TaskGroupManager) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);
        this._setWebviewMessageListener(this._panel.webview);

        // Listen for task changes and update webview
        this.taskGroupManager.on('tasks-updated', () => {
            this.update();
        });

        // Send initial data
        this._panel.webview.postMessage({ command: 'set-route', route: 'tasks-document' });
        this.update();
    }

    public static render(extensionUri: vscode.Uri, taskGroupManager: TaskGroupManager) {
        if (TaskPanel.currentPanel) {
            TaskPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'ai-agent-tasks',
                'Task Dashboard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(extensionUri, 'out'),
                        vscode.Uri.joinPath(extensionUri, 'webview-ui/build')
                    ]
                }
            );

            TaskPanel.currentPanel = new TaskPanel(panel, extensionUri, taskGroupManager);
        }
    }

    public dispose() {
        TaskPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    public async update() {
        if (this._panel && this._panel.visible) {
            const groups = await this.taskGroupManager.getAll();
            const activeGroup = groups.find(g => g.status === 'in-progress') || groups[0];

            this._panel.webview.postMessage({
                command: 'update-task-list',
                taskGroups: groups,
                activeGroupId: activeGroup?.id
            });
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
        const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);
        const nonce = getNonce();

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Task Dashboard</title>
        </head>
        <body>
          <div id="root"></div>
          <script nonce="${nonce}">
            window.initialRoute = 'tasks-document';
          </script>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                const command = message.command;
                const text = message.text;

                switch (command) {
                    case 'webview-ready':
                        // Resend route on ready
                        webview.postMessage({ command: 'set-route', route: 'tasks-document' });
                        this.update();
                        break;

                    case 'toggle-subtask':
                        // Synchronize changes back to manager
                        // (Same logic as ChatPanelProvider)
                        const { groupId, subtaskId, completed } = message;
                        await this.taskGroupManager.updateSubtaskStatus(
                            groupId,
                            subtaskId,
                            completed ? 'completed' : 'not-started'
                        );
                        // The manager update will persist, but we need to refresh UI
                        // Ideally, manager emits event. For now, we manually update.
                        this.update();
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }
}
