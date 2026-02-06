import { ProjectState, FileMetadata } from '../services/project-indexer';

/**
 * Prunes project context to only include information relevant to the user's query.
 * Reduces token usage by filtering file tree, dependencies, and context.
 */
export class ContextPruner {
    /**
     * Filter project files to those likely relevant to the user's query.
     */
    public static findRelevantFiles(query: string, files: FileMetadata[]): FileMetadata[] {
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

        // Score each file by relevance to the query
        const scored = files.map(file => {
            let score = 0;
            const pathLower = file.path.toLowerCase();
            const fileName = pathLower.split(/[/\\]/).pop() || '';
            const baseName = fileName.replace(/\.\w+$/, '');

            // Direct file mention in query
            if (queryLower.includes(fileName) || queryLower.includes(baseName)) {
                score += 10;
            }

            // Query words match path segments
            for (const word of queryWords) {
                if (pathLower.includes(word)) {
                    score += 3;
                }
            }

            // Topic-based relevance
            if (queryLower.includes('test') && (pathLower.includes('test') || pathLower.includes('spec'))) {
                score += 5;
            }
            if (queryLower.includes('style') && (pathLower.includes('.css') || pathLower.includes('style'))) {
                score += 5;
            }
            if (queryLower.includes('component') && pathLower.includes('component')) {
                score += 5;
            }
            if (queryLower.includes('api') && (pathLower.includes('api') || pathLower.includes('route'))) {
                score += 5;
            }
            if (queryLower.includes('auth') && pathLower.includes('auth')) {
                score += 5;
            }
            if (queryLower.includes('config') && pathLower.includes('config')) {
                score += 5;
            }

            return { file, score };
        });

        // Return files with score > 0, sorted by relevance
        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20)
            .map(s => s.file);
    }

    /**
     * Filter dependencies to those relevant to the query or to the relevant files.
     */
    public static filterRelevantDependencies(
        query: string,
        dependencies: Record<string, string>,
        relevantFiles: FileMetadata[]
    ): Record<string, string> {
        const queryLower = query.toLowerCase();
        const result: Record<string, string> = {};

        for (const [name, version] of Object.entries(dependencies)) {
            const nameLower = name.toLowerCase();

            // Always include core frameworks
            if (['react', 'next', 'vue', 'express', 'fastify', 'typescript'].includes(nameLower)) {
                result[name] = version;
                continue;
            }

            // Include if mentioned in query
            if (queryLower.includes(nameLower) || queryLower.includes(nameLower.replace(/-/g, ' '))) {
                result[name] = version;
                continue;
            }

            // Topic-based matching
            if (queryLower.includes('test') && ['jest', 'vitest', 'mocha', 'cypress'].includes(nameLower)) {
                result[name] = version;
            }
            if (queryLower.includes('style') && ['tailwindcss', 'sass', 'styled-components'].includes(nameLower)) {
                result[name] = version;
            }
            if (queryLower.includes('database') && ['prisma', 'mongoose', 'typeorm', 'pg', 'sqlite3'].includes(nameLower)) {
                result[name] = version;
            }
        }

        return result;
    }

    /**
     * Prune the file tree to only show directories relevant to the query.
     */
    public static pruneFileTree(
        files: FileMetadata[],
        relevantFiles: FileMetadata[]
    ): Set<string> {
        const relevantDirs = new Set<string>();

        for (const file of relevantFiles) {
            const parts = file.path.split(/[/\\]/);
            if (parts.length >= 2) {
                relevantDirs.add(parts[0]);
                if (parts.length >= 3) {
                    relevantDirs.add(`${parts[0]}/${parts[1]}`);
                }
            }
        }

        return relevantDirs;
    }

    /**
     * Build a pruned project context string for the system prompt.
     * Returns empty string if no relevant files found (falls back to full context).
     */
    public static buildPrunedContext(
        query: string,
        projectState: ProjectState
    ): { relevantFiles: FileMetadata[]; relevantDeps: Record<string, string>; hasRelevantContext: boolean } {
        const relevantFiles = this.findRelevantFiles(query, projectState.files);

        if (relevantFiles.length === 0) {
            return {
                relevantFiles: [],
                relevantDeps: {},
                hasRelevantContext: false
            };
        }

        const relevantDeps = this.filterRelevantDependencies(
            query,
            projectState.dependencies || {},
            relevantFiles
        );

        return {
            relevantFiles,
            relevantDeps,
            hasRelevantContext: true
        };
    }
}
