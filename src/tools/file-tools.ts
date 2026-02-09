import * as fs from 'fs';
import * as path from 'path';
import { Tool } from './tool-interface';

export class ReadFileTool implements Tool {
    name = 'read_file';
    description = 'Read the contents of a file. Returns the full file content.';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the file from workspace root' }
        },
        required: ['path']
    };

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const relativePath = (typeof args === 'string' ? args : args?.path || '').trim();

            if (!relativePath) {
                return 'Error: Missing file path. Usage: {"tool": "read_file", "args": {"path": "src/file.ts"}}';
            }

            const fullPath = path.resolve(this.workspaceRoot, relativePath);

            // Security check: ensure path is within workspace
            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied. Cannot read files outside workspace.`;
            }

            if (!fs.existsSync(fullPath)) {
                return `Error: File not found: ${relativePath}`;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            // Return with line numbers for easier editing
            const numberedContent = lines.map((line, i) => `${String(i + 1).padStart(4, ' ')} | ${line}`).join('\n');
            return `File: ${relativePath} (${lines.length} lines)\n${'─'.repeat(50)}\n${numberedContent}`;
        } catch (error: any) {
            return `Error reading file: ${error.message}`;
        }
    }
}

export class ListDirTool implements Tool {
    name = 'list_directory';
    description = 'List files and directories in a path. Use "." for the root directory.';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the directory (use "." for root)' }
        },
        required: ['path']
    };

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            let relativePath = (typeof args === 'string' ? args : args?.path || '').trim();

            // Handle empty or "." as root
            if (!relativePath || relativePath === '.') {
                relativePath = '';
            }

            const fullPath = path.resolve(this.workspaceRoot, relativePath);

            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied.`;
            }

            if (!fs.existsSync(fullPath)) {
                return `Error: Directory not found: ${relativePath || '.'}`;
            }

            const stat = fs.statSync(fullPath);
            if (!stat.isDirectory()) {
                return `Error: Not a directory: ${relativePath}`;
            }

            const files = fs.readdirSync(fullPath, { withFileTypes: true });
            const formatted = files
                .filter(f => !f.name.startsWith('.') && f.name !== 'node_modules')
                .map(f => {
                    const icon = f.isDirectory() ? '📁' : '📄';
                    const type = f.isDirectory() ? '/' : '';
                    return `${icon} ${f.name}${type}`;
                })
                .join('\n');

            return `Directory: ${relativePath || '.'}\n${'─'.repeat(40)}\n${formatted}`;
        } catch (error: any) {
            return `Error listing directory: ${error.message}`;
        }
    }
}

export class WriteFileTool implements Tool {
    name = 'write_file';
    description = 'Create a new file or completely overwrite an existing file. Use edit_file for modifying existing files.';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the file' },
            content: { type: 'string', description: 'Complete file content to write' }
        },
        required: ['path', 'content']
    };
    requiresConfirmation = true;

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const rawPath = typeof args === 'string' ? args : args?.path;
            const content = typeof args === 'string' ? '' : args?.content;

            if (!rawPath) {
                return 'Error: Missing file path';
            }

            if (content === undefined || content === null) {
                return 'Error: Missing content';
            }

            const relativePath = rawPath.trim();
            const fullPath = path.resolve(this.workspaceRoot, relativePath);

            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied.`;
            }

            // Create directory if needed
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const isNew = !fs.existsSync(fullPath);
            fs.writeFileSync(fullPath, content, 'utf-8');

            const lines = content.split('\n').length;
            return `✅ ${isNew ? 'Created' : 'Wrote'}: ${relativePath} (${lines} lines, ${content.length} chars)`;
        } catch (error: any) {
            return `Error writing file: ${error.message}`;
        }
    }
}

export class EditFileTool implements Tool {
    name = 'edit_file';
    description = 'Edit a file by replacing specific text. Use for targeted modifications. The old_string must match exactly.';
    parameters = {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Relative path to the file' },
            old_string: { type: 'string', description: 'Exact text to find and replace (must match exactly)' },
            new_string: { type: 'string', description: 'New text to replace with' }
        },
        required: ['path', 'old_string', 'new_string']
    };
    requiresConfirmation = true;

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const filePath = args?.path?.trim();
            const oldString = args?.old_string;
            const newString = args?.new_string;

            if (!filePath) {
                return 'Error: Missing file path';
            }

            if (oldString === undefined || oldString === null) {
                return 'Error: Missing old_string to find';
            }

            if (newString === undefined || newString === null) {
                return 'Error: Missing new_string to replace with';
            }

            const fullPath = path.resolve(this.workspaceRoot, filePath);

            if (!fullPath.startsWith(this.workspaceRoot)) {
                return `Error: Access denied.`;
            }

            if (!fs.existsSync(fullPath)) {
                return `Error: File not found: ${filePath}`;
            }

            const content = fs.readFileSync(fullPath, 'utf-8');

            // Check if old_string exists
            if (!content.includes(oldString)) {
                // Try to find similar content for helpful error
                const lines = content.split('\n');
                const preview = lines.slice(0, 20).map((l, i) => `${i + 1}: ${l}`).join('\n');
                return `Error: Could not find the specified text to replace.\n\nFile preview (first 20 lines):\n${preview}\n\nMake sure old_string matches exactly including whitespace.`;
            }

            // Count occurrences
            const occurrences = (content.match(new RegExp(escapeRegExp(oldString), 'g')) || []).length;

            if (occurrences > 1) {
                return `Error: Found ${occurrences} occurrences of the text. Please provide more context to make it unique.`;
            }

            // Perform the replacement
            const newContent = content.replace(oldString, newString);
            fs.writeFileSync(fullPath, newContent, 'utf-8');

            // Calculate what changed
            const oldLines = oldString.split('\n').length;
            const newLines = newString.split('\n').length;
            const diff = newLines - oldLines;

            let changeDesc = '';
            if (diff > 0) {
                changeDesc = `(+${diff} lines)`;
            } else if (diff < 0) {
                changeDesc = `(${diff} lines)`;
            } else {
                changeDesc = '(modified)';
            }

            return `✅ Edited: ${filePath} ${changeDesc}`;
        } catch (error: any) {
            return `Error editing file: ${error.message}`;
        }
    }
}

// Helper to escape regex special characters
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class SearchFilesTool implements Tool {
    name = 'search_files';
    description = 'Search for files by name pattern. Returns matching file paths.';
    parameters = {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: 'Search pattern (e.g., "*.ts", "test", "component")' },
            path: { type: 'string', description: 'Directory to search in (optional, defaults to root)' }
        },
        required: ['pattern']
    };

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const pattern = (args?.pattern || '').toLowerCase();
            const searchPath = args?.path || '';

            if (!pattern) {
                return 'Error: Missing search pattern';
            }

            const basePath = path.resolve(this.workspaceRoot, searchPath);
            const results: string[] = [];

            const searchDir = (dir: string, depth: number = 0) => {
                if (depth > 5 || results.length > 50) return; // Limit depth and results

                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        // Skip hidden and node_modules
                        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

                        const fullPath = path.join(dir, entry.name);
                        const relativePath = path.relative(this.workspaceRoot, fullPath);

                        if (entry.isDirectory()) {
                            searchDir(fullPath, depth + 1);
                        } else {
                            // Check if name matches pattern
                            if (entry.name.toLowerCase().includes(pattern) ||
                                matchGlob(entry.name, pattern)) {
                                results.push(relativePath);
                            }
                        }
                    }
                } catch (e) {
                    // Skip directories we can't read
                }
            };

            searchDir(basePath);

            if (results.length === 0) {
                return `No files found matching "${pattern}"`;
            }

            return `Found ${results.length} files:\n${results.map(f => `📄 ${f}`).join('\n')}`;
        } catch (error: any) {
            return `Error searching files: ${error.message}`;
        }
    }
}

// Simple glob matching
function matchGlob(filename: string, pattern: string): boolean {
    if (pattern.startsWith('*.')) {
        return filename.endsWith(pattern.slice(1));
    }
    return filename.includes(pattern);
}

export class GrepTool implements Tool {
    name = 'search_code';
    description = 'Search for text content within files. Returns matching lines with file paths.';
    parameters = {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: 'Text or regex pattern to search for' },
            path: { type: 'string', description: 'File or directory to search (optional)' },
            file_type: { type: 'string', description: 'File extension filter (e.g., "ts", "js")' }
        },
        required: ['pattern']
    };

    constructor(private workspaceRoot: string) { }

    async execute(args: any): Promise<string> {
        try {
            const pattern = args?.pattern;
            const searchPath = args?.path || '';
            const fileType = args?.file_type;

            if (!pattern) {
                return 'Error: Missing search pattern';
            }

            const basePath = path.resolve(this.workspaceRoot, searchPath);
            const results: string[] = [];
            const regex = new RegExp(pattern, 'gi');

            const searchFile = (filePath: string) => {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const lines = content.split('\n');
                    const relativePath = path.relative(this.workspaceRoot, filePath);

                    lines.forEach((line, idx) => {
                        if (regex.test(line)) {
                            results.push(`${relativePath}:${idx + 1}: ${line.trim().slice(0, 100)}`);
                        }
                        regex.lastIndex = 0; // Reset regex state
                    });
                } catch (e) {
                    // Skip files we can't read
                }
            };

            const searchDir = (dir: string, depth: number = 0) => {
                if (depth > 5 || results.length > 100) return;

                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

                        const fullPath = path.join(dir, entry.name);

                        if (entry.isDirectory()) {
                            searchDir(fullPath, depth + 1);
                        } else {
                            // Check file type filter
                            if (fileType && !entry.name.endsWith(`.${fileType}`)) continue;
                            // Only search text files
                            if (/\.(ts|js|tsx|jsx|json|md|css|html|py|rs|go|java|c|cpp|h)$/i.test(entry.name)) {
                                searchFile(fullPath);
                            }
                        }
                    }
                } catch (e) {
                    // Skip
                }
            };

            // Check if it's a file or directory
            const stat = fs.existsSync(basePath) ? fs.statSync(basePath) : null;
            if (stat?.isFile()) {
                searchFile(basePath);
            } else {
                searchDir(basePath);
            }

            if (results.length === 0) {
                return `No matches found for "${pattern}"`;
            }

            const showing = results.slice(0, 30);
            const more = results.length > 30 ? `\n... and ${results.length - 30} more matches` : '';
            return `Found ${results.length} matches:\n${showing.join('\n')}${more}`;
        } catch (error: any) {
            return `Error searching: ${error.message}`;
        }
    }
}
