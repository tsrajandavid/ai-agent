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

You have access to the following tools (via text commands):
- To read a file: \`read_file path/to/file\`
- To list files: \`list_dir path/to/dir\`

Rules:
1. Always be concise.
2. Use markdown for code blocks.
3. When referencing files, use their relative path from the root.
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
