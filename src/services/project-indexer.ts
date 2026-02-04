import * as vscode from 'vscode';
import fastGlob from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

export interface FileMetadata {
    path: string;
    size: number;
    language: string;
}

export interface ProjectState {
    files: FileMetadata[];
    dependencies: string[];
    frameworks: string[];
}

export class ProjectIndexer {
    private workspaceRoot: string;
    private ignoreManager = ignore();

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    public async initialize(): Promise<void> {
        await this.loadGitignore();
    }

    private async loadGitignore(): Promise<void> {
        const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            this.ignoreManager.add(content);
        }
    }

    public async scanFiles(): Promise<ProjectState> {
        const entries = await fastGlob('**/*', {
            cwd: this.workspaceRoot,
            dot: true,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**'],
            stats: true,
            objectMode: true
        });

        const files: FileMetadata[] = [];
        let dependencies: string[] = [];
        let frameworks: string[] = [];

        for (const entry of entries) {
            // Apply .gitignore
            if (this.ignoreManager.ignores(entry.path)) {
                continue;
            }

            files.push({
                path: entry.path,
                size: entry.stats?.size || 0,
                language: path.extname(entry.path).replace('.', '')
            });

            // Parse package.json for dependencies and frameworks
            if (path.basename(entry.path) === 'package.json') {
                const pkgInfo = this.parsePackageJson(path.join(this.workspaceRoot, entry.path));
                dependencies = [...new Set([...dependencies, ...pkgInfo.dependencies])];
                frameworks = [...new Set([...frameworks, ...pkgInfo.frameworks])];
            }
        }

        return {
            files,
            dependencies,
            frameworks
        };
    }

    private parsePackageJson(filePath: string): { dependencies: string[], frameworks: string[] } {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const pkg = JSON.parse(content);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            const depList = Object.keys(allDeps);

            const detectedFrameworks: string[] = [];
            if (allDeps['react']) detectedFrameworks.push('React');
            if (allDeps['vue']) detectedFrameworks.push('Vue');
            if (allDeps['@angular/core']) detectedFrameworks.push('Angular');
            if (allDeps['express']) detectedFrameworks.push('Express');
            if (allDeps['next']) detectedFrameworks.push('Next.js');
            if (allDeps['svelte']) detectedFrameworks.push('Svelte');

            return {
                dependencies: depList,
                frameworks: detectedFrameworks
            };
        } catch (e) {
            console.error(`Failed to parse ${filePath}:`, e);
            return { dependencies: [], frameworks: [] };
        }
    }
}
