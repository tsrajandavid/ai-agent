import { ProjectIndexer } from '../services/project-indexer';
import { LLMService } from '../llm/llm-service';

export class ContextAnalyzer {
    constructor(
        private readonly projectIndexer: ProjectIndexer,
        private readonly llmService: LLMService
    ) { }

    public async analyze(): Promise<string> {
        console.log('[ContextAnalyzer] Starting analysis...');

        // 1. Get project state
        const projectState = await this.projectIndexer.scanFiles();

        // 2. Prepare context for LLM
        // 2. Prepare context for LLM (Limit to top 200 files)
        const fileList = projectState.files
            .slice(0, 200)
            .map(f => `- ${f.path} (${f.language})`)
            .join('\n');

        if (projectState.files.length > 200) {
            console.warn(`[ContextAnalyzer] Truncating file list from ${projectState.files.length} to 200 items`);
        }
        const dependencies = Object.entries(projectState.dependencies)
            .map(([dep, ver]) => `- ${dep}: ${ver}`)
            .join('\n');

        const prompt = `
You are a Senior Software Architect. Analyze the following project structure and dependencies to provide a high-level architectural summary.

PROJECT FILES:
${fileList}

DEPENDENCIES:
${dependencies}

INSTRUCTIONS:
1. Identify the core tech stack and frameworks.
2. Infer the architectural pattern (e.g., MVC, Hexagonal, Feature-based).
3. Summarize the main modules/components.
4. Identify any key configuration or infrastructure files.
5. Keep the response concise, structured in Markdown.

FORMAT:
# Project Analysis
## Tech Stack
...
## Architecture
...
## Key Modules
...
`;

        // 3. Call LLM
        console.log('[ContextAnalyzer] Sending prompt to LLM...');
        try {
            const analysis = await this.llmService.sendRequest([{ role: 'user', content: prompt }]);
            return analysis || "Failed to generate analysis (Empty response).";
        } catch (error: any) {
            console.error('[ContextAnalyzer] LLM generation failed:', error);
            return `Error generating project analysis: ${error.message || error}`;
        }
    }
}
