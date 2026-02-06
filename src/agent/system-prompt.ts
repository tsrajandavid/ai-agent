import { ProjectState } from '../services/project-indexer';

export type AgentMode = 'PLAN' | 'ACT' | 'ASK';

export class SystemPromptGenerator {
    constructor(private readonly projectState: ProjectState) { }

    public generate(mode: AgentMode, contextFiles: Record<string, string> = {}): string {
        // Strong, explicit instructions for small models
        const toolsSection = `
# CRITICAL: NEVER WRITE CODE IN CHAT

You are a VS Code AI assistant. You have tools to create and edit files.

## ABSOLUTE RULE - READ THIS CAREFULLY
NEVER write code blocks in your response.
NEVER paste code in chat.
NEVER show "here's the code" followed by a code block.
ALWAYS use the write_file tool to create files.

When user asks to create code/files:
1. Say briefly what you will create
2. Output ONLY the JSON tool call
3. The tool will show approval UI to user

## TOOL FORMAT

Create a file (outputs ONLY this JSON, nothing else):
\`\`\`json
{"tool": "write_file", "args": {"path": "filename.js", "content": "// file content"}}
\`\`\`

Read a file:
\`\`\`json
{"tool": "read_file", "args": {"path": "filename.js"}}
\`\`\`

Edit a file:
\`\`\`json
{"tool": "edit_file", "args": {"path": "filename.js", "old_string": "old text", "new_string": "new text"}}
\`\`\`

Run command:
\`\`\`json
{"tool": "run_command", "args": {"command": "npm test"}}
\`\`\`

## EXAMPLES

User: "Create a chess game"

WRONG (DO NOT DO THIS):
"Here's a chess game:
\\\`\\\`\\\`javascript
const board = document.getElementById('board');
// ... more code
\\\`\\\`\\\`"

CORRECT:
"I'll create a chess game with the necessary files."
\`\`\`json
{"tool": "write_file", "args": {"path": "chess.html", "content": "<!DOCTYPE html>..."}}
\`\`\`

User: "Create hello.txt with hello world"

CORRECT:
\`\`\`json
{"tool": "write_file", "args": {"path": "hello.txt", "content": "hello world"}}
\`\`\`

## REMEMBER
- User asks for code → USE write_file TOOL
- User asks to create file → USE write_file TOOL
- User asks to edit file → USE edit_file TOOL
- NEVER paste code in chat messages
`;

        // Build context section if files are selected
        let contextSection = '';
        const contextPaths = Object.keys(contextFiles);
        if (contextPaths.length > 0) {
            contextSection = `\n## Context Files\n`;
            for (const [filePath, content] of Object.entries(contextFiles)) {
                const preview = content.length > 1500 ? content.slice(0, 1500) + '\n...(truncated)' : content;
                contextSection += `### ${filePath}\n\`\`\`\n${preview}\n\`\`\`\n`;
            }
        }

        // Mode-specific
        let modeNote = '';
        if (mode === 'ASK') {
            modeNote = '\n## MODE: ASK ONLY\nAnswer questions only. Do not create or modify files.';
        } else if (mode === 'PLAN') {
            modeNote = '\n## MODE: PLANNING\nDescribe what you will do, then use tools to execute.';
        }

        return `${toolsSection}${contextSection}${modeNote}

For questions that don't require file creation, answer normally without code blocks.
If the user wants code created, USE THE TOOLS - never paste code in chat.`;
    }
}
