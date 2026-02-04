import { Tool } from './tool-interface';

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
            .map(t => `- ${t.name}: ${t.description}`)
            .join('\n');
    }

    async executeTool(command: string, args: any): Promise<string> {
        const tool = this.tools.get(command);
        if (!tool) {
            return `Error: Tool '${command}' not found.`;
        }
        return await tool.execute(args);
    }

    // Simple text parser for "command arg" style
    parseCommand(input: string): { command: string, args: any } | null {
        const parts = input.trim().split(' ');
        if (parts.length < 2) return null;

        const command = parts[0];
        const args = parts.slice(1).join(' '); // Simple join for single argument tools like read_file

        if (this.tools.has(command)) {
            return { command, args };
        }
        return null;
    }
}
