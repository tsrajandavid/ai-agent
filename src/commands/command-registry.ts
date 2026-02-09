import { SlashCommand } from './command-interface';
import * as vscode from 'vscode';

export class CommandRegistry {
    private commands: Map<string, SlashCommand> = new Map();

    register(command: SlashCommand) {
        this.commands.set(command.name.toLowerCase(), command);
    }

    getCommand(name: string): SlashCommand | undefined {
        return this.commands.get(name.toLowerCase());
    }

    getCommands(): SlashCommand[] {
        return Array.from(this.commands.values());
    }

    async execute(name: string, args: string, webview: vscode.Webview): Promise<boolean> {
        const command = this.getCommand(name);
        if (!command) {
            return false;
        }

        try {
            await command.execute(args, webview);
            return true;
        } catch (error: any) {
            console.error(`Status command '${name}' failed:`, error);
            webview.postMessage({
                command: 'response-complete',
                text: `❌ Command '${name}' failed: ${error.message}`,
                role: 'system'
            });
            return true; // We handled it, even if it failed
        }
    }
}
