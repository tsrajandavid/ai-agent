# Tool System Guide

## Overview

The tool system is the core of your AI agent. It defines what actions the agent can take.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TOOL SYSTEM                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      TOOL REGISTRY                               │   │
│   │   Stores all tool definitions and executors                      │   │
│   └───────────────────────────┬─────────────────────────────────────┘   │
│                               │                                          │
│           ┌───────────────────┼───────────────────┐                     │
│           │                   │                   │                     │
│           ▼                   ▼                   ▼                     │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐            │
│   │  FILE TOOLS   │   │ TERMINAL TOOLS│   │  GIT TOOLS    │            │
│   │               │   │               │   │               │            │
│   │ • read_file   │   │ • run_command │   │ • git_status  │            │
│   │ • write_file  │   │               │   │ • git_diff    │            │
│   │ • edit_file   │   │               │   │ • git_add     │            │
│   │ • list_dir    │   │               │   │ • git_commit  │            │
│   │ • search_code │   │               │   │ • git_push    │            │
│   └───────────────┘   └───────────────┘   └───────────────┘            │
│                               │                                          │
│                               ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      TOOL EXECUTOR                               │   │
│   │   1. Validate inputs                                             │   │
│   │   2. Check permissions                                           │   │
│   │   3. Execute tool                                                │   │
│   │   4. Format result                                               │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tool Interface

```typescript
// src/tools/types.ts

export interface Tool {
    // Unique identifier
    name: string;
    
    // Shown to LLM - be descriptive!
    description: string;
    
    // JSON Schema for parameters
    parameters: {
        type: 'object';
        properties: Record<string, ParameterSchema>;
        required: string[];
    };
    
    // Execute the tool
    execute: (args: Record<string, any>) => Promise<ToolResult>;
    
    // Optional: Validate before execution
    validate?: (args: Record<string, any>) => ValidationResult;
    
    // Optional: Requires user confirmation?
    requiresConfirmation?: boolean;
}

export interface ParameterSchema {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    enum?: string[];
    items?: ParameterSchema;
    default?: any;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
    suggestion?: string;
}
```

---

## Tool Registry

```typescript
// src/tools/ToolRegistry.ts

import { Tool, ToolResult, ValidationResult } from './types';

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    // Register a tool
    register(tool: Tool): void {
        this.tools.set(tool.name, tool);
    }

    // Register multiple tools
    registerAll(tools: Tool[]): void {
        tools.forEach(t => this.register(t));
    }

    // Get tool by name
    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    // Get all tools
    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    // Get OpenAI-format tool definitions (for LLM)
    getDefinitions(): OpenAITool[] {
        return this.getAll().map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }

    // Execute a tool
    async execute(name: string, args: Record<string, any>): Promise<ToolResult> {
        const tool = this.tools.get(name);
        
        if (!tool) {
            return {
                success: false,
                output: '',
                error: `Unknown tool: ${name}`
            };
        }

        // Validate if validator exists
        if (tool.validate) {
            const validation = tool.validate(args);
            if (!validation.valid) {
                return {
                    success: false,
                    output: '',
                    error: validation.error,
                    suggestion: validation.suggestion
                };
            }
        }

        // Execute
        try {
            return await tool.execute(args);
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

interface OpenAITool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}
```

---

## File Tools

### read_file

```typescript
// src/tools/file/readFile.ts

import * as vscode from 'vscode';
import { Tool, ToolResult, ValidationResult } from '../types';
import { ProjectIndexer } from '../../indexer/ProjectIndexer';

export function createReadFileTool(
    workspaceRoot: vscode.Uri,
    indexer: ProjectIndexer
): Tool {
    return {
        name: 'read_file',
        description: 'Read the contents of a file in the workspace. Always use this before editing a file to get the current content.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Relative path to the file from workspace root (e.g., "src/index.ts")'
                },
                start_line: {
                    type: 'number',
                    description: 'Optional: Start reading from this line (1-indexed)'
                },
                end_line: {
                    type: 'number',
                    description: 'Optional: Stop reading at this line (1-indexed)'
                }
            },
            required: ['path']
        },

        // Validate path exists (anti-hallucination)
        validate({ path }): ValidationResult {
            const index = indexer.getIndex();
            const fileExists = index.files.some(f => f.path === path);

            if (!fileExists) {
                // Find similar files to suggest
                const similar = findSimilarFiles(path, index.files);
                return {
                    valid: false,
                    error: `File "${path}" does not exist in the project.`,
                    suggestion: similar.length > 0
                        ? `Did you mean: ${similar.join(', ')}?`
                        : 'Use list_directory to see available files.'
                };
            }

            return { valid: true };
        },

        async execute({ path, start_line, end_line }): Promise<ToolResult> {
            try {
                const fileUri = vscode.Uri.joinPath(workspaceRoot, path);
                const contentBytes = await vscode.workspace.fs.readFile(fileUri);
                let content = new TextDecoder().decode(contentBytes);

                // Handle line range
                if (start_line || end_line) {
                    const lines = content.split('\n');
                    const start = (start_line || 1) - 1;
                    const end = end_line || lines.length;
                    content = lines.slice(start, end).join('\n');
                }

                // Add line numbers for reference
                const numberedContent = content
                    .split('\n')
                    .map((line, i) => `${(start_line || 1) + i}: ${line}`)
                    .join('\n');

                return {
                    success: true,
                    output: `File: ${path}\n${'─'.repeat(40)}\n${numberedContent}`
                };
            } catch (error) {
                return {
                    success: false,
                    output: '',
                    error: `Failed to read file: ${error}`
                };
            }
        }
    };
}

// Helper: Find files with similar names
function findSimilarFiles(target: string, files: { path: string }[]): string[] {
    const targetName = target.split('/').pop()?.toLowerCase() || '';
    
    return files
        .filter(f => {
            const fileName = f.path.split('/').pop()?.toLowerCase() || '';
            return fileName.includes(targetName) || targetName.includes(fileName);
        })
        .slice(0, 3)
        .map(f => f.path);
}
```

### write_file

```typescript
// src/tools/file/writeFile.ts

import * as vscode from 'vscode';
import { Tool, ToolResult } from '../types';

export function createWriteFileTool(workspaceRoot: vscode.Uri): Tool {
    return {
        name: 'write_file',
        description: 'Create a new file or overwrite an existing file with content.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Relative path for the new file'
                },
                content: {
                    type: 'string',
                    description: 'Content to write to the file'
                }
            },
            required: ['path', 'content']
        },

        // Requires confirmation because it's destructive
        requiresConfirmation: true,

        async execute({ path, content }): Promise<ToolResult> {
            try {
                const fileUri = vscode.Uri.joinPath(workspaceRoot, path);
                
                // Create parent directories if needed
                const parentDir = vscode.Uri.joinPath(fileUri, '..');
                try {
                    await vscode.workspace.fs.createDirectory(parentDir);
                } catch {
                    // Directory might already exist
                }

                // Write file
                await vscode.workspace.fs.writeFile(
                    fileUri,
                    Buffer.from(content, 'utf-8')
                );

                return {
                    success: true,
                    output: `✅ File created: ${path} (${content.length} characters)`
                };
            } catch (error) {
                return {
                    success: false,
                    output: '',
                    error: `Failed to write file: ${error}`
                };
            }
        }
    };
}
```

### edit_file

```typescript
// src/tools/file/editFile.ts

import * as vscode from 'vscode';
import { Tool, ToolResult, ValidationResult } from '../types';
import { ProjectIndexer } from '../../indexer/ProjectIndexer';

export function createEditFileTool(
    workspaceRoot: vscode.Uri,
    indexer: ProjectIndexer
): Tool {
    return {
        name: 'edit_file',
        description: 'Edit a file by replacing specific text. IMPORTANT: You must read the file first to get the exact text to replace.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'File path'
                },
                old_text: {
                    type: 'string',
                    description: 'EXACT text to find (must match exactly, including whitespace)'
                },
                new_text: {
                    type: 'string',
                    description: 'Text to replace with'
                }
            },
            required: ['path', 'old_text', 'new_text']
        },

        requiresConfirmation: true,

        validate({ path }): ValidationResult {
            const index = indexer.getIndex();
            const fileExists = index.files.some(f => f.path === path);

            if (!fileExists) {
                return {
                    valid: false,
                    error: `Cannot edit "${path}" - file does not exist.`,
                    suggestion: 'Use write_file to create a new file.'
                };
            }

            return { valid: true };
        },

        async execute({ path, old_text, new_text }): Promise<ToolResult> {
            try {
                const fileUri = vscode.Uri.joinPath(workspaceRoot, path);
                const contentBytes = await vscode.workspace.fs.readFile(fileUri);
                const content = new TextDecoder().decode(contentBytes);

                // Check if old_text exists
                if (!content.includes(old_text)) {
                    return {
                        success: false,
                        output: '',
                        error: `Could not find the exact text to replace.\n\nSearched for:\n\`\`\`\n${old_text.slice(0, 200)}${old_text.length > 200 ? '...' : ''}\n\`\`\`\n\nPlease use read_file to get the current content and try again with the exact text.`
                    };
                }

                // Check for multiple occurrences
                const occurrences = content.split(old_text).length - 1;
                if (occurrences > 1) {
                    return {
                        success: false,
                        output: '',
                        error: `Found ${occurrences} occurrences of the text. Please provide more context to uniquely identify the text to replace.`
                    };
                }

                // Perform replacement
                const newContent = content.replace(old_text, new_text);
                
                await vscode.workspace.fs.writeFile(
                    fileUri,
                    Buffer.from(newContent, 'utf-8')
                );

                return {
                    success: true,
                    output: `✅ File edited: ${path}\n\nReplaced:\n\`\`\`\n${old_text.slice(0, 100)}${old_text.length > 100 ? '...' : ''}\n\`\`\`\n\nWith:\n\`\`\`\n${new_text.slice(0, 100)}${new_text.length > 100 ? '...' : ''}\n\`\`\``
                };
            } catch (error) {
                return {
                    success: false,
                    output: '',
                    error: `Failed to edit file: ${error}`
                };
            }
        }
    };
}
```

### list_directory

```typescript
// src/tools/file/listDirectory.ts

import * as vscode from 'vscode';
import { Tool, ToolResult } from '../types';

export function createListDirectoryTool(workspaceRoot: vscode.Uri): Tool {
    return {
        name: 'list_directory',
        description: 'List files and folders in a directory. Use this to explore the project structure.',
        parameters: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Directory path (empty or "." for workspace root)'
                },
                recursive: {
                    type: 'boolean',
                    description: 'Include subdirectories (default: false, max depth: 3)'
                }
            },
            required: []
        },

        async execute({ path = '.', recursive = false }): Promise<ToolResult> {
            try {
                const dirUri = path === '.' || path === ''
                    ? workspaceRoot
                    : vscode.Uri.joinPath(workspaceRoot, path);

                const entries = await listDir(dirUri, workspaceRoot, recursive ? 3 : 1, 0);
                
                return {
                    success: true,
                    output: `📁 ${path || 'workspace root'}\n\n${entries.join('\n')}`
                };
            } catch (error) {
                return {
                    success: false,
                    output: '',
                    error: `Failed to list directory: ${error}`
                };
            }
        }
    };
}

async function listDir(
    dirUri: vscode.Uri,
    rootUri: vscode.Uri,
    maxDepth: number,
    currentDepth: number,
    prefix: string = ''
): Promise<string[]> {
    if (currentDepth >= maxDepth) return [];

    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    const results: string[] = [];

    // Sort: folders first, then files
    entries.sort((a, b) => {
        if (a[1] === b[1]) return a[0].localeCompare(b[0]);
        return a[1] === vscode.FileType.Directory ? -1 : 1;
    });

    for (const [name, type] of entries) {
        // Skip hidden files and common ignored directories
        if (name.startsWith('.') || name === 'node_modules' || name === 'dist') {
            continue;
        }

        const icon = type === vscode.FileType.Directory ? '📁' : '📄';
        results.push(`${prefix}${icon} ${name}`);

        // Recurse into directories
        if (type === vscode.FileType.Directory && currentDepth < maxDepth - 1) {
            const subUri = vscode.Uri.joinPath(dirUri, name);
            const subEntries = await listDir(
                subUri, rootUri, maxDepth, currentDepth + 1, prefix + '  '
            );
            results.push(...subEntries);
        }
    }

    return results;
}
```

### search_code

```typescript
// src/tools/file/searchCode.ts

import * as vscode from 'vscode';
import { Tool, ToolResult } from '../types';

export function createSearchCodeTool(): Tool {
    return {
        name: 'search_code',
        description: 'Search for text or patterns across all files in the workspace.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Text or pattern to search for'
                },
                file_pattern: {
                    type: 'string',
                    description: 'Glob pattern to filter files (e.g., "**/*.ts")'
                },
                max_results: {
                    type: 'number',
                    description: 'Maximum results to return (default: 20)'
                }
            },
            required: ['query']
        },

        async execute({ query, file_pattern = '**/*', max_results = 20 }): Promise<ToolResult> {
            try {
                const results: SearchResult[] = [];

                // Use VS Code's findTextInFiles
                await vscode.workspace.findTextInFiles(
                    { pattern: query },
                    {
                        include: file_pattern,
                        exclude: '**/node_modules/**',
                        maxResults: max_results,
                        previewOptions: {
                            matchLines: 1,
                            charsPerLine: 100
                        }
                    },
                    result => {
                        const relativePath = vscode.workspace.asRelativePath(result.uri);
                        for (const match of result.ranges) {
                            results.push({
                                file: relativePath,
                                line: match.start.line + 1,
                                preview: result.preview.text.trim()
                            });
                        }
                    }
                );

                if (results.length === 0) {
                    return {
                        success: true,
                        output: `No results found for "${query}"`
                    };
                }

                const output = results
                    .map(r => `📄 ${r.file}:${r.line}\n   ${r.preview}`)
                    .join('\n\n');

                return {
                    success: true,
                    output: `Found ${results.length} results for "${query}":\n\n${output}`
                };
            } catch (error) {
                return {
                    success: false,
                    output: '',
                    error: `Search failed: ${error}`
                };
            }
        }
    };
}

interface SearchResult {
    file: string;
    line: number;
    preview: string;
}
```

---

## Terminal Tool

```typescript
// src/tools/terminal/runCommand.ts

import * as vscode from 'vscode';
import * as cp from 'child_process';
import { Tool, ToolResult } from '../types';

export function createRunCommandTool(workspaceRoot: string): Tool {
    return {
        name: 'run_command',
        description: 'Execute a shell command in the workspace. Use for npm, git, build commands, etc.',
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'Command to execute'
                },
                cwd: {
                    type: 'string',
                    description: 'Working directory (relative to workspace)'
                }
            },
            required: ['command']
        },

        requiresConfirmation: true,

        async execute({ command, cwd }): Promise<ToolResult> {
            return new Promise((resolve) => {
                const execOptions: cp.ExecOptions = {
                    cwd: cwd ? `${workspaceRoot}/${cwd}` : workspaceRoot,
                    timeout: 60000, // 60 second timeout
                    maxBuffer: 1024 * 1024 * 5 // 5MB buffer
                };

                cp.exec(command, execOptions, (error, stdout, stderr) => {
                    let output = '';

                    if (stdout) {
                        output += `STDOUT:\n${stdout}\n`;
                    }
                    if (stderr) {
                        output += `STDERR:\n${stderr}\n`;
                    }

                    if (error) {
                        if (error.killed) {
                            resolve({
                                success: false,
                                output: output,
                                error: 'Command timed out after 60 seconds'
                            });
                        } else {
                            resolve({
                                success: false,
                                output: output,
                                error: `Command failed with exit code ${error.code}`
                            });
                        }
                    } else {
                        resolve({
                            success: true,
                            output: output || 'Command completed successfully (no output)'
                        });
                    }
                });
            });
        }
    };
}
```

---

## Git Tools

```typescript
// src/tools/git/index.ts

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { Tool, ToolResult } from '../types';

export function createGitTools(workspaceRoot: string): Tool[] {
    const git: SimpleGit = simpleGit(workspaceRoot);

    return [
        // git_status
        {
            name: 'git_status',
            description: 'Get the current git status showing changed, staged, and untracked files.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            },

            async execute(): Promise<ToolResult> {
                try {
                    const status = await git.status();
                    return {
                        success: true,
                        output: formatStatus(status)
                    };
                } catch (error) {
                    return {
                        success: false,
                        output: '',
                        error: `Git error: ${error}`
                    };
                }
            }
        },

        // git_diff
        {
            name: 'git_diff',
            description: 'Show the diff of changes.',
            parameters: {
                type: 'object',
                properties: {
                    staged: {
                        type: 'boolean',
                        description: 'Show only staged changes'
                    },
                    file: {
                        type: 'string',
                        description: 'Show diff for specific file'
                    }
                },
                required: []
            },

            async execute({ staged = false, file }): Promise<ToolResult> {
                try {
                    const args = staged ? ['--cached'] : [];
                    if (file) args.push(file);
                    
                    const diff = await git.diff(args);
                    return {
                        success: true,
                        output: diff || 'No changes to show'
                    };
                } catch (error) {
                    return {
                        success: false,
                        output: '',
                        error: `Git error: ${error}`
                    };
                }
            }
        },

        // git_add
        {
            name: 'git_add',
            description: 'Stage files for commit.',
            parameters: {
                type: 'object',
                properties: {
                    files: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Files to stage. Use ["."] to stage all.'
                    }
                },
                required: ['files']
            },

            requiresConfirmation: true,

            async execute({ files }): Promise<ToolResult> {
                try {
                    await git.add(files);
                    return {
                        success: true,
                        output: `✅ Staged: ${files.join(', ')}`
                    };
                } catch (error) {
                    return {
                        success: false,
                        output: '',
                        error: `Git error: ${error}`
                    };
                }
            }
        },

        // git_commit
        {
            name: 'git_commit',
            description: 'Create a git commit with staged changes.',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'Commit message'
                    }
                },
                required: ['message']
            },

            requiresConfirmation: true,

            async execute({ message }): Promise<ToolResult> {
                try {
                    const result = await git.commit(message);
                    return {
                        success: true,
                        output: `✅ Committed: ${result.commit}\n\n"${message}"`
                    };
                } catch (error) {
                    return {
                        success: false,
                        output: '',
                        error: `Git error: ${error}`
                    };
                }
            }
        },

        // git_push
        {
            name: 'git_push',
            description: 'Push commits to remote repository.',
            parameters: {
                type: 'object',
                properties: {
                    remote: {
                        type: 'string',
                        description: 'Remote name (default: origin)'
                    },
                    branch: {
                        type: 'string',
                        description: 'Branch name (default: current branch)'
                    }
                },
                required: []
            },

            requiresConfirmation: true,

            async execute({ remote = 'origin', branch }): Promise<ToolResult> {
                try {
                    const currentBranch = branch || (await git.branch()).current;
                    await git.push(remote, currentBranch);
                    return {
                        success: true,
                        output: `✅ Pushed to ${remote}/${currentBranch}`
                    };
                } catch (error) {
                    return {
                        success: false,
                        output: '',
                        error: `Git error: ${error}`
                    };
                }
            }
        },

        // git_log
        {
            name: 'git_log',
            description: 'Show recent commit history.',
            parameters: {
                type: 'object',
                properties: {
                    count: {
                        type: 'number',
                        description: 'Number of commits to show (default: 10)'
                    }
                },
                required: []
            },

            async execute({ count = 10 }): Promise<ToolResult> {
                try {
                    const log = await git.log({ maxCount: count });
                    const output = log.all
                        .map(c => `${c.hash.slice(0, 7)} - ${c.message} (${c.author_name})`)
                        .join('\n');
                    return {
                        success: true,
                        output: `Recent commits:\n\n${output}`
                    };
                } catch (error) {
                    return {
                        success: false,
                        output: '',
                        error: `Git error: ${error}`
                    };
                }
            }
        }
    ];
}

function formatStatus(status: StatusResult): string {
    let output = `Branch: ${status.current}\n`;
    
    if (status.ahead > 0) output += `↑ ${status.ahead} ahead\n`;
    if (status.behind > 0) output += `↓ ${status.behind} behind\n`;
    
    output += '\n';
    
    if (status.staged.length > 0) {
        output += '📦 Staged:\n';
        output += status.staged.map(f => `  ✅ ${f}`).join('\n') + '\n\n';
    }
    
    if (status.modified.length > 0) {
        output += '📝 Modified:\n';
        output += status.modified.map(f => `  🔸 ${f}`).join('\n') + '\n\n';
    }
    
    if (status.not_added.length > 0) {
        output += '❓ Untracked:\n';
        output += status.not_added.map(f => `  ➕ ${f}`).join('\n') + '\n\n';
    }
    
    if (status.deleted.length > 0) {
        output += '🗑️ Deleted:\n';
        output += status.deleted.map(f => `  ❌ ${f}`).join('\n') + '\n\n';
    }
    
    if (status.staged.length === 0 && status.modified.length === 0 && 
        status.not_added.length === 0 && status.deleted.length === 0) {
        output += '✨ Working tree clean\n';
    }
    
    return output;
}
```

---

## Tool Executor with Confirmation

```typescript
// src/tools/ToolExecutor.ts

import { Tool, ToolResult } from './types';
import { ToolRegistry } from './ToolRegistry';

export class ToolExecutor {
    constructor(
        private registry: ToolRegistry,
        private confirmationHandler: ConfirmationHandler
    ) {}

    async execute(
        toolName: string,
        args: Record<string, any>
    ): Promise<ToolResult> {
        const tool = this.registry.get(toolName);
        
        if (!tool) {
            return {
                success: false,
                output: '',
                error: `Unknown tool: ${toolName}`
            };
        }

        // Check if confirmation is required
        if (tool.requiresConfirmation) {
            const confirmed = await this.confirmationHandler.confirm(
                toolName,
                args
            );
            
            if (!confirmed) {
                return {
                    success: false,
                    output: '',
                    error: 'Operation cancelled by user'
                };
            }
        }

        // Execute through registry (includes validation)
        return this.registry.execute(toolName, args);
    }
}

export interface ConfirmationHandler {
    confirm(toolName: string, args: Record<string, any>): Promise<boolean>;
}
```

### Confirmation Handler Implementation

```typescript
// src/tools/VSCodeConfirmationHandler.ts

import * as vscode from 'vscode';
import { ConfirmationHandler } from './ToolExecutor';

export class VSCodeConfirmationHandler implements ConfirmationHandler {
    async confirm(toolName: string, args: Record<string, any>): Promise<boolean> {
        const message = this.formatConfirmationMessage(toolName, args);
        
        const result = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Approve',
            'Reject'
        );
        
        return result === 'Approve';
    }

    private formatConfirmationMessage(toolName: string, args: Record<string, any>): string {
        switch (toolName) {
            case 'write_file':
                return `Create/overwrite file: ${args.path}?`;
            case 'edit_file':
                return `Edit file: ${args.path}?`;
            case 'run_command':
                return `Run command: ${args.command}?`;
            case 'git_add':
                return `Stage files: ${args.files.join(', ')}?`;
            case 'git_commit':
                return `Commit with message: "${args.message}"?`;
            case 'git_push':
                return `Push to ${args.remote || 'origin'}/${args.branch || 'current'}?`;
            default:
                return `Execute ${toolName}?`;
        }
    }
}
```

---

## Registering All Tools

```typescript
// src/tools/index.ts

import * as vscode from 'vscode';
import { ToolRegistry } from './ToolRegistry';
import { ToolExecutor, ConfirmationHandler } from './ToolExecutor';
import { VSCodeConfirmationHandler } from './VSCodeConfirmationHandler';
import { ProjectIndexer } from '../indexer/ProjectIndexer';

// File tools
import { createReadFileTool } from './file/readFile';
import { createWriteFileTool } from './file/writeFile';
import { createEditFileTool } from './file/editFile';
import { createListDirectoryTool } from './file/listDirectory';
import { createSearchCodeTool } from './file/searchCode';

// Terminal tools
import { createRunCommandTool } from './terminal/runCommand';

// Git tools
import { createGitTools } from './git';

export function createToolSystem(
    workspaceFolder: vscode.WorkspaceFolder,
    indexer: ProjectIndexer
): { registry: ToolRegistry; executor: ToolExecutor } {
    const workspaceRoot = workspaceFolder.uri;
    const workspacePath = workspaceRoot.fsPath;

    // Create registry
    const registry = new ToolRegistry();

    // Register file tools
    registry.register(createReadFileTool(workspaceRoot, indexer));
    registry.register(createWriteFileTool(workspaceRoot));
    registry.register(createEditFileTool(workspaceRoot, indexer));
    registry.register(createListDirectoryTool(workspaceRoot));
    registry.register(createSearchCodeTool());

    // Register terminal tools
    registry.register(createRunCommandTool(workspacePath));

    // Register git tools
    registry.registerAll(createGitTools(workspacePath));

    // Create executor with confirmation handler
    const confirmationHandler = new VSCodeConfirmationHandler();
    const executor = new ToolExecutor(registry, confirmationHandler);

    return { registry, executor };
}
```

---

## Using in Agent Loop

```typescript
// src/agent/AgentLoop.ts

import { ToolRegistry } from '../tools/ToolRegistry';
import { ToolExecutor } from '../tools/ToolExecutor';
import { OpenRouterClient } from '../llm/OpenRouterClient';

export class AgentLoop {
    constructor(
        private llm: OpenRouterClient,
        private toolRegistry: ToolRegistry,
        private toolExecutor: ToolExecutor,
        private webview: WebviewInterface
    ) {}

    async run(userMessage: string, history: Message[]): Promise<void> {
        const messages: Message[] = [
            { role: 'system', content: this.buildSystemPrompt() },
            ...history,
            { role: 'user', content: userMessage }
        ];

        // Get tool definitions for LLM
        const tools = this.toolRegistry.getDefinitions();

        while (true) {
            // Call LLM with tools
            const response = await this.llm.chatWithTools(messages, tools);

            // Check for tool calls
            if (response.toolCalls && response.toolCalls.length > 0) {
                // Add assistant message
                messages.push({
                    role: 'assistant',
                    content: response.content,
                    tool_calls: response.toolCalls
                });

                // Execute each tool
                for (const toolCall of response.toolCalls) {
                    // Notify UI
                    this.webview.postMessage({
                        type: 'toolCall',
                        id: toolCall.id,
                        name: toolCall.name,
                        arguments: toolCall.arguments,
                        status: 'running'
                    });

                    // Execute
                    const result = await this.toolExecutor.execute(
                        toolCall.name,
                        toolCall.arguments
                    );

                    // Add result to messages
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result.success 
                            ? result.output 
                            : `Error: ${result.error}`
                    });

                    // Notify UI
                    this.webview.postMessage({
                        type: 'toolResult',
                        id: toolCall.id,
                        name: toolCall.name,
                        result: result,
                        status: result.success ? 'completed' : 'failed'
                    });
                }
            } else {
                // No tool calls - send final response
                this.webview.postMessage({
                    type: 'response',
                    content: response.content
                });
                break;
            }
        }
    }
}
```

---

## Summary

### Tool Categories

| Category | Tools |
|----------|-------|
| **File** | read_file, write_file, edit_file, list_directory, search_code |
| **Terminal** | run_command |
| **Git** | git_status, git_diff, git_add, git_commit, git_push, git_log |

### Safety Features

| Feature | Purpose |
|---------|---------|
| Path validation | Prevent hallucinated file paths |
| Exact match for edits | Prevent wrong replacements |
| User confirmation | Control dangerous operations |
| Timeout | Prevent hanging commands |

### Best Practices

1. **Always validate** tool inputs before execution
2. **Require confirmation** for destructive operations
3. **Provide helpful errors** with suggestions
4. **Format output** for readability
5. **Handle edge cases** (empty results, timeouts, etc.)

---

*This guide covers the complete tool system for your VS Code AI agent.*