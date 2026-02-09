import { ProjectState, FileMetadata } from '../services/project-indexer';

/**
 * Prunes project context to only include information relevant to the user's query.
 * Reduces token usage by filtering file tree, dependencies, and context.
 */
export class ContextPruner {
    /**
     * Filter project files to those likely relevant to the user's query.
     */
    public static findRelevantFiles(query: string, files: FileMetadata[], activeTaskGroup?: any, recentFiles?: string[]): FileMetadata[] {
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        const recentSet = new Set(recentFiles || []);

        // Get active subtask context
        const currentSubtask = activeTaskGroup?.subtasks?.find((s: any) => s.status === 'in-progress');
        const assignedFiles = new Set(currentSubtask?.assignedFiles || []);

        // Boost keywords from subtask title
        const subtaskKeywords = currentSubtask?.title
            ? currentSubtask.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
            : [];

        // Score each file by relevance to the query
        const scored = files.map(file => {
            let score = 0;
            const pathLower = file.path.toLowerCase();
            const fileName = pathLower.split(/[/\\]/).pop() || '';
            const baseName = fileName.replace(/\.\w+$/, '');

            // 1. Direct file mention in query
            if (queryLower.includes(fileName) || queryLower.includes(baseName)) {
                score += 10;
            }

            // 2. Query words match path segments
            for (const word of queryWords) {
                if (pathLower.includes(word)) {
                    score += 3;
                }
            }

            // 3. Task Group Weights (Phase 3 Feature)
            // A. Explicitly assigned file (+20)
            if (assignedFiles.has(file.path)) {
                score += 20;
            }

            // B. Recent Activity (+15)
            if (recentSet.has(file.path)) {
                score += 15;
            }

            // B. Matches current subtask keywords (+8)
            for (const word of subtaskKeywords) {
                if (pathLower.includes(word)) {
                    score += 8;
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

        // 4. Import Tracing (Score > 10 triggers trace)
        // We do a second pass to boost dependencies of high-scoring files
        const highScoringFiles = scored.filter(s => s.score >= 10);
        const boostMap = new Map<string, number>();

        for (const s of highScoringFiles) {
            if (s.file.imports && s.file.imports.length > 0) {
                for (const imp of s.file.imports) {
                    // Simple resolution
                    let targetPath = '';
                    if (imp.startsWith('.')) {
                        const simpleName = imp.split(/[/\\]/).pop();
                        if (simpleName) {
                            targetPath = simpleName;
                        }
                    }

                    if (targetPath) {
                        // Find file that looks like this import
                        const match = files.find(f => {
                            const fName = f.path.split(/[/\\]/).pop()?.replace(/\.\w+$/, '');
                            return fName === targetPath;
                        });

                        if (match) {
                            boostMap.set(match.path, (boostMap.get(match.path) || 0) + 5);
                        }
                    }
                }
            }
        }

        // Apply boosts
        for (const s of scored) {
            if (boostMap.has(s.file.path)) {
                s.score += boostMap.get(s.file.path)!;
            }
        }

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
        projectState: ProjectState,
        activeTaskGroup?: any,
        recentFiles?: string[]
    ): { relevantFiles: FileMetadata[]; relevantDeps: Record<string, string>; hasRelevantContext: boolean } {
        const relevantFiles = this.findRelevantFiles(query, projectState.files, activeTaskGroup, recentFiles);

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
