import { ProjectState } from '../services/project-indexer';

export type AgentMode = 'PLAN' | 'ACT' | 'ASK';

export class SystemPromptGenerator {
    constructor(private readonly projectState: ProjectState) { }

    public generate(mode: AgentMode): string {
        const baseSystemPrompt = `You are an AI coding assistant inside VS Code.

IMPORTANT: For simple questions (math, counting, general knowledge, explanations), just answer directly WITHOUT using any tools.
Only use tools when you need to interact with files or run commands.

Available Tools (use EXACT names with underscores):
- read_file: Read file content. Args: { "path": "relative/path" }
- list_dir: List directory. Args: { "path": "relative/path" }
- write_file: Write to file. Args: { "path": "relative/path", "content": "..." }
- run_command: Run shell command. Args: { "command": "..." }
- git_status: Get git status. Args: {}
- git_diff: Get git diff. Args: {}
- git_log: Get git log. Args: {}

Tool Format (only when needed):
\`\`\`json
{
  "tool": "read_file",
  "args": { "path": "src/index.ts" }
}
\`\`\`

Project: ${this.projectState.files?.length || 0} files indexed.
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

            default:
                return baseSystemPrompt;
        }
    }

}
