export interface Tool {
    name: string;
    description: string;
    parameters?: Record<string, any>; // JSON Schema for parameters
    requiresConfirmation?: boolean;
    execute(args: any): Promise<string>;
    validate?(args: any): { valid: boolean; error?: string };
}

export interface ToolRegistry {
    getTool(name: string): Tool | undefined;
    getAllTools(): Tool[];
}
