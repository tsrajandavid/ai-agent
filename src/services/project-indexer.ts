import * as vscode from 'vscode';
import fastGlob from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

export interface FileMetadata {
    path: string;
    size: number;
    language: string;
    imports?: string[];
}

export interface ProjectState {
    name: string;
    files: FileMetadata[];
    dependencies: Record<string, string>;
    frameworks: string[];
}

export class ProjectIndexer {
    private workspaceRoot: string;
    private ignoreManager = ignore();
    private cache: ProjectState | null = null;
    private watcher: vscode.FileSystemWatcher | undefined;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public async initialize(): Promise<void> {
        await this.loadGitignore();

        // Setup watcher to invalidate cache on changes
        // Watch for file creates, deletes, and changes
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*');
        const invalidate = () => {
            if (this.cache) {
                console.log('ProjectIndexer: Cache invalidated');
                this.cache = null;
            }
        };

        this.watcher.onDidCreate(invalidate);
        this.watcher.onDidDelete(invalidate);
        this.watcher.onDidChange((uri) => {
            // Only invalidate if we care about the file type (optimization)
            // For now, just invalidate to be safe, or maybe just update that entry
            // Simple approach: invalidate everything
            invalidate();
        });
    }

    private async loadGitignore(): Promise<void> {
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            this.ignoreManager.add(content);
        }
    }

    public async scanFiles(): Promise<ProjectState> {
        if (this.cache) {
            console.log('ProjectIndexer: Using cached state');
            return this.cache;
        }

        console.log('ProjectIndexer: Scanning files...');
        const entries = await fastGlob('**/*', {
            cwd: this.workspaceRoot,
            dot: true,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**'],
            stats: true,
            objectMode: true
        });

        const files: FileMetadata[] = [];
        let dependencies: Record<string, string> = {};
        let frameworks: string[] = [];

        for (const entry of entries) {
            // Apply .gitignore
            if (this.ignoreManager.ignores(entry.path)) {
                continue;
            }

            const ext = path.extname(entry.path).toLowerCase();
            const language = ext.replace('.', '');
            let imports: string[] = [];

            // Extract imports for JS/TS files
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext) && entry.stats && entry.stats.size < 50 * 1024) {
                try {
                    const content = fs.readFileSync(path.join(this.workspaceRoot, entry.path), 'utf-8');
                    imports = this.extractImports(content);
                } catch (e) {
                    // Ignore read errors
                }
            }

            files.push({
                path: entry.path,
                size: entry.stats?.size || 0,
                language,
                imports
            });

            // Parse package.json for dependencies and frameworks
            if (path.basename(entry.path) === 'package.json') {
                const pkgInfo = this.parsePackageJson(path.join(this.workspaceRoot, entry.path));
                dependencies = { ...dependencies, ...pkgInfo.dependencies };
                frameworks = [...new Set([...frameworks, ...pkgInfo.frameworks])];
            }
        }

        this.cache = {
            name: path.basename(this.workspaceRoot),
            files,
            dependencies,
            frameworks
        };

        return this.cache;
    }

    private extractImports(content: string): string[] {
        const imports: string[] = [];
        // Match import ... from '...' or require('...')
        const importRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1] || match[2];
            if (importPath && (importPath.startsWith('./') || importPath.startsWith('../'))) {
                imports.push(importPath);
            }
        }
        return imports;
    }

    private parsePackageJson(filePath: string): { dependencies: Record<string, string>, frameworks: string[] } {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const pkg = JSON.parse(content);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            const detectedFrameworks: string[] = [];

            if (allDeps['react']) detectedFrameworks.push('React');
            if (allDeps['vue']) detectedFrameworks.push('Vue');
            if (allDeps['@angular/core']) detectedFrameworks.push('Angular');
            if (allDeps['express']) detectedFrameworks.push('Express');
            if (allDeps['next']) detectedFrameworks.push('Next.js');
            if (allDeps['svelte']) detectedFrameworks.push('Svelte');

            return {
                dependencies: allDeps,
                frameworks: detectedFrameworks
            };
        } catch (e) {
            console.error(`Failed to parse ${filePath}:`, e);
            return { dependencies: {}, frameworks: [] };
        }
    }

    public dispose() {
        this.watcher?.dispose();
    }
}
