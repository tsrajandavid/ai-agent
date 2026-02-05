import { Tool } from './tool-interface';
import * as vscode from 'vscode';

export class ToolManager {
    private tools: Map<string, Tool> = new Map();

    registerTool(tool: Tool) {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getToolsDescription(): string {
        return Array.from(this.tools.values())
            .map(t => {
                const params = t.parameters ? ` Args: ${JSON.stringify(t.parameters)}` : '';
                return `- ${t.name}: ${t.description}${params}`;
            })
            .join('\n');
    }

    async executeTool(command: string, args: any): Promise<string> {
        const tool = this.tools.get(command);
        if (!tool) {
            return `Error: Tool '${command}' not found.`;
        }

        // Validation
        if (tool.validate) {
            const validation = tool.validate(args);
            if (!validation.valid) {
                return `Error: Invalid arguments for ${command}. ${validation.error}`;
            }
        }

        // Confirmation
        if (tool.requiresConfirmation) {
            const message = `Allow AI to execute '${command}' with args: ${JSON.stringify(args)}?`;
            const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Approve');
            if (choice !== 'Approve') {
                return `Error: User denied execution of '${command}'.`;
            }
        }

        try {
            return await tool.execute(args);
        } catch (error) {
            return `Error executing ${command}: ${error}`;
        }
    }

    // Parsers support both JSON blocks and legacy "command arg" format
    parseCommand(input: string): { command: string, args: any } | null {
        const trimmed = input.trim();

        // 1. Try JSON parsing
        // Look for markdown code blocks with json or just braces
        const jsonMatch = trimmed.match(/```json\s*(\{[\s\S]*?\})\s*```/) || trimmed.match(/(\{[\s\S]*?\})/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.tool && parsed.args) {
                    return { command: parsed.tool, args: parsed.args };
                }
                // Alternate format: { "tool_name": { args... } } - maybe later
            } catch (e) {
                // Not valid JSON, fall through
            }
        }

        // 2. Legacy parser (command arg)
        const parts = trimmed.split(' ');
        if (parts.length >= 1) {
            const command = parts[0];
            if (this.tools.has(command)) {
                // If it's a known tool, treat the rest as a single string arg (common for read_file)
                const args = parts.slice(1).join(' ');
                return { command, args: args ? { path: args } : {} }; // Fallback mapping for simple tools
            }
        }

        return null;
    }
}
