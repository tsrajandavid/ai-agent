import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './tool-interface';

export class ReadFileTool implements Tool {
    name = 'read_file';
    description = 'Read the contents of a file. Usage: read_file <path>';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the file' }
        },
        required: ['path']
    };

    constructor(private workspaceRoot: string) { }

    async execute(relativePath: string): Promise<string> {
        try {
            const fullPath = path.resolve(this.workspaceRoot, relativePath.trim());

            // Security check: ensure path is within workspace
            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied. Cannot read files outside workspace.`;
            }

            if (!fs.existsSync(fullPath)) {
                return `Error: File not found: ${relativePath}`;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            return content;
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    }
}

export class ListDirTool implements Tool {
    name = 'list_dir';
    description = 'List files in a directory. Usage: list_dir <path>';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the directory' }
        },
        required: ['path']
    };

    constructor(private workspaceRoot: string) { }

    async execute(relativePath: string): Promise<string> {
        try {
            const fullPath = path.resolve(this.workspaceRoot, relativePath.trim());

            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied.`;
            }

            if (!fs.existsSync(fullPath)) {
                return `Error: Directory not found: ${relativePath}`;
            }

            const files = fs.readdirSync(fullPath, { withFileTypes: true });
            return files.map(f => {
                const type = f.isDirectory() ? '[DIR]' : '[FILE]';
                return `${type} ${f.name}`;
            }).join('\n');
        } catch (error: any) {
            return `Error listing directory: ${error.message}`;
        }
    }
}

export class WriteFileTool implements Tool {
    name = 'write_file';
    description = 'Write content to a file. Usage: write_file <path> <content>';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the file' },
            content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
    };
    requiresConfirmation = true;

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const rawPath = typeof args === 'string' ? args : args.path;
            const content = typeof args === 'string' ? '' : args.content;

            if (!rawPath || !content) {
                return 'Error: Missing path or content';
            }

            const relativePath = rawPath.trim();
            const fullPath = path.resolve(this.workspaceRoot, relativePath);

            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied.`;
            }

            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(fullPath, args.content, 'utf-8');
            return `Success: Wrote to ${relativePath}`;
        } catch (error: any) {
            return `Error writing file: ${error.message}`;
        }
    }
}
