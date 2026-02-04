export interface Tool {
    name: string;
    description: string;
    execute(args: any): Promise<string>;
}

export interface ToolRegistry {
    getTool(name: string): Tool | undefined;
    getAllTools(): Tool[];
}
