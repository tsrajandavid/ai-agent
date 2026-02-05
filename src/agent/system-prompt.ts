import { ProjectState } from '../services/project-indexer';

export type AgentMode = 'PLAN' | 'ACT' | 'ASK';

export class SystemPromptGenerator {
    constructor(private readonly projectState: ProjectState) { }

    public generate(mode: AgentMode, contextFiles: Record<string, string> = {}): string {
        const toolsSection = `
## CRITICAL: Tool Usage

You MUST use tools for file operations. When asked to create, read, edit, or work with files, ALWAYS respond with ONLY a JSON tool call.

**Response format when using a tool:**
\`\`\`json
{"tool": "tool_name", "args": {...}}
\`\`\`

### Available Tools

**File Operations:**
- **write_file** - Create or overwrite a file
  Example: \`{"tool": "write_file", "args": {"path": "test.txt", "content": "hello world"}}\`

- **read_file** - Read file contents
  Example: \`{"tool": "read_file", "args": {"path": "src/index.ts"}}\`

- **edit_file** - Edit existing file (find and replace)
  Example: \`{"tool": "edit_file", "args": {"path": "file.ts", "old_string": "old text", "new_string": "new text"}}\`

- **list_dir** - List directory contents
  Example: \`{"tool": "list_dir", "args": {"path": "."}}\`

- **search_files** - Find files by pattern
  Example: \`{"tool": "search_files", "args": {"pattern": "*.ts"}}\`

- **grep** - Search text in files
  Example: \`{"tool": "grep", "args": {"pattern": "TODO"}}\`

**Terminal & Git:**
- **run_command** - Run shell command
- **git_status** - Get git status
- **git_diff** - Show changes
- **git_log** - Show commits

## MANDATORY RULES

1. When user says "create file X" → respond with ONLY: \`{"tool": "write_file", "args": {"path": "X", "content": "..."}}\`
2. When user says "read file X" → respond with ONLY: \`{"tool": "read_file", "args": {"path": "X"}}\`
3. When user says "edit file X" → respond with ONLY: \`{"tool": "edit_file", "args": {...}}\`
4. DO NOT explain how to create files - USE THE TOOL
5. DO NOT show code examples - USE THE TOOL
6. Your response should be ONLY the JSON tool call, nothing else
`;

        const rulesSection = `
## Important Rules

1. **Read before edit**: Always read a file before modifying it to understand its structure
2. **Use edit_file for changes**: For existing files, use edit_file with exact matching text
3. **Be precise**: The old_string in edit_file must match exactly (including whitespace)
4. **One tool at a time**: Use one tool per response, wait for results
5. **Simple questions**: For general questions, answer directly without tools
6. **Explain your actions**: Tell the user what you're doing and why
`;

        const projectInfo = `
## Project Context
- Files indexed: ${this.projectState.files?.length || 0}
- Frameworks: ${this.projectState.frameworks?.join(', ') || 'None detected'}
`;

        // Build context section if files are selected
        let contextSection = '';
        const contextPaths = Object.keys(contextFiles);
        if (contextPaths.length > 0) {
            contextSection = `
## Active Context (User Selected Files)
The user has added these files to context. Prioritize them in your analysis:

`;
            for (const [filePath, content] of Object.entries(contextFiles)) {
                const preview = content.length > 2000 ? content.slice(0, 2000) + '\n... (truncated)' : content;
                contextSection += `### ${filePath}\n\`\`\`\n${preview}\n\`\`\`\n\n`;
            }
        }

        // Mode-specific instructions
        let modeInstructions = '';
        switch (mode) {
            case 'PLAN':
                modeInstructions = `
## Mode: Planning
Before making changes, briefly plan then execute:
1. Understand the user's request
2. Use tools to explore if needed
3. Execute the required changes using tools

You CAN and SHOULD use write_file and edit_file when the user asks to create or modify files.`;
                break;

            case 'ACT':
                modeInstructions = `
## Mode: Action
Directly execute file operations:
1. Use write_file to create files
2. Use edit_file to modify files
3. Use read_file to view files

When user asks to create a file, immediately use write_file tool.`;
                break;

            case 'ASK':
                modeInstructions = `
## Mode: Ask
Answer questions and explain code. You can read files but do NOT modify anything.`;
                break;
        }

        return `You are an AI coding assistant integrated into VS Code. You help developers understand, write, and modify code.

${toolsSection}
${rulesSection}
${projectInfo}
${contextSection}
${modeInstructions}

Remember: Be helpful, precise, and explain your reasoning. When using tools, output ONLY the JSON block for the tool call.`;
    }
}
