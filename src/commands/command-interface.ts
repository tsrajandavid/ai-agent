import * as vscode from 'vscode';

export interface SlashCommand {
    name: string;
    description: string;
    execute(args: string, webview: vscode.Webview): Promise<void>;
}
