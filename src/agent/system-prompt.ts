import { ProjectState } from '../services/project-indexer';

export type AgentMode = 'PLAN' | 'ACT' | 'ASK';

export class SystemPromptGenerator {
    constructor(private readonly projectState: ProjectState) { }

    public generate(mode: AgentMode): string {
        const baseSystemPrompt = `You are an expert AI Coding Agent inside VS Code.
Your goal is to help the user plan, act, and answer questions about their codebase.

Current Project Context:
- Frameworks: ${this.projectState.frameworks.join(', ') || 'None detected'}
- Dependencies: ${this.projectState.dependencies.length} detected
- Files: ${this.projectState.files.length} indexed

File Tree:
${this.generateFileTree()}

You have access to the following tools. To use them, output a JSON block with the tool name and arguments.

Format:
\`\`\`json
{
  "tool": "tool_name",
  "args": {
    "arg_name": "value"
  }
}
\`\`\`

Available Tools:
- read_file: Read a file's content. Args: { "path": "path/to/file" }
- write_file: Write content to a file. Args: { "path": "path/to/file", "content": "file content" }
- list_dir: List files in a directory. Args: { "path": "path/to/dir" }
- run_command: Execute a shell command. Args: { "command": "npm install" }
- git_status, git_diff, git_log: Git operations.

Rules:
1. Always be concise.
2. Use markdown for code blocks.
3. When referencing files, use their relative path from the root.
4. To use a tool, YOU MUST use the JSON format shown above.
`;

        switch (mode) {
            case 'PLAN':
                return `${baseSystemPrompt}
MODE: PLAN
- Analyze the user's request and the file tree.
- Create a step-by-step plan.
- DO NOT write code yet, just plan.
- Suggest which files need to be created or modified.`;

            case 'ACT':
                return `${baseSystemPrompt}
MODE: ACT
- You are strictly an execution agent.
- Output code changes directly or use tools to modify files.
- Follow the plan if provided.`;

            case 'ASK':
                return `${baseSystemPrompt}
MODE: ASK
- Answer questions about the codebase.
- Explain concepts or debug issues.
- Do not modify files.`;
        }
    }

    private generateFileTree(): string {
        // Simple flat list for now, can be optimized to a tree structure later
        return this.projectState.files
            .slice(0, 500) // Limit to 500 files to save tokens for now
            .map(f => `- ${f.path} (${f.language})`)
            .join('\n');
    }
}
