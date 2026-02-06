import { Tool } from './tool-interface';
import * as vscode from 'vscode';

export class ToolManager {
    private tools: Map<string, Tool> = new Map();

    registerTool(tool: Tool) {
        console.log(`[ToolManager] Registering tool: ${tool.name}`);
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getRegisteredToolNames(): string[] {
        return Array.from(this.tools.keys());
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
        console.log(`[ToolManager] executeTool called: ${command}`, args);
        console.log(`[ToolManager] Available tools: ${this.getRegisteredToolNames().join(', ')}`);

        const tool = this.tools.get(command);
        if (!tool) {
            console.error(`[ToolManager] Tool '${command}' not found!`);
            return `Error: Tool '${command}' not found. Available: ${this.getRegisteredToolNames().join(', ')}`;
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

        // 1. Try to extract JSON with proper brace matching
        const jsonStr = this.extractJSON(trimmed);
        if (jsonStr) {
            try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.tool && parsed.args) {
                    console.log('[ToolManager] Parsed tool call:', parsed.tool);
                    return { command: parsed.tool, args: parsed.args };
                }
            } catch (e) {
                console.log('[ToolManager] JSON parse failed:', e);
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

    // Extract JSON object with proper brace matching (handles nested objects)
    private extractJSON(input: string): string | null {
        // First try markdown code block
        const codeBlockMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            const content = codeBlockMatch[1].trim();
            if (content.startsWith('{')) {
                return this.extractBalancedJSON(content);
            }
        }

        // Find the first { that might start a tool call
        const toolPatterns = [
            /\{"tool"\s*:/,
            /\{\s*"tool"\s*:/,
            /\{'tool'\s*:/
        ];

        for (const pattern of toolPatterns) {
            const match = input.match(pattern);
            if (match && match.index !== undefined) {
                const startIdx = match.index;
                const result = this.extractBalancedJSON(input.slice(startIdx));
                if (result) return result;
            }
        }

        // Fallback: find any JSON object
        const firstBrace = input.indexOf('{');
        if (firstBrace !== -1) {
            return this.extractBalancedJSON(input.slice(firstBrace));
        }

        return null;
    }

    // Extract a balanced JSON object by counting braces
    private extractBalancedJSON(input: string): string | null {
        if (!input.startsWith('{')) return null;

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = 0; i < input.length; i++) {
            const char = input[i];

            if (escape) {
                escape = false;
                continue;
            }

            if (char === '\\' && inString) {
                escape = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') {
                    depth++;
                } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        // Found complete JSON object
                        return input.slice(0, i + 1);
                    }
                }
            }
        }

        return null; // Unbalanced braces
    }
}
