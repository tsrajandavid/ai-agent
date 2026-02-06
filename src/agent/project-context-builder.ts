import { ProjectState } from '../services/project-indexer';

export interface ProjectContext {
    projectName: string;
    projectType: string;
    framework: string;
    language: string;
    fileTree: string;
    dependencies: string;
    scripts: string;
    currentFile?: string;
    selection?: string;
}

export class ProjectContextBuilder {
    constructor(private readonly projectState: ProjectState) { }

    public build(currentFile?: string, selection?: string): string {
        const context = this.extractContext(currentFile, selection);
        return this.formatContext(context);
    }

    private extractContext(currentFile?: string, selection?: string): ProjectContext {
        const framework = this.detectFramework();
        const language = this.detectLanguage();

        return {
            projectName: this.projectState.name || 'Unknown',
            projectType: this.detectProjectType(),
            framework,
            language,
            fileTree: this.buildFileTree(),
            dependencies: this.formatDependencies(),
            scripts: this.formatScripts(),
            currentFile,
            selection
        };
    }

    private detectFramework(): string {
        const deps = this.projectState.dependencies || {};

        if (deps['next']) return 'Next.js';
        if (deps['react']) return 'React';
        if (deps['vue']) return 'Vue';
        if (deps['express']) return 'Express';
        if (deps['fastify']) return 'Fastify';

        return 'None';
    }

    private detectLanguage(): string {
        const hasTS = this.projectState.files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));
        const hasJS = this.projectState.files.some(f => f.path.endsWith('.js') || f.path.endsWith('.jsx'));

        if (hasTS) return 'TypeScript';
        if (hasJS) return 'JavaScript';

        return 'Unknown';
    }

    private detectProjectType(): string {
        const deps = this.projectState.dependencies || {};

        if (deps['react'] || deps['next'] || deps['vue']) return 'Frontend/Fullstack';
        if (deps['express'] || deps['fastify']) return 'Backend';

        return 'General';
    }

    private static readonly MAX_TREE_LINES = 30;

    private buildFileTree(): string {
        const files = this.projectState.files;

        // Build a map: dir -> { subdirs, fileCount }
        const dirMap = new Map<string, { subdirs: Set<string>; fileCount: number }>();

        files.forEach(file => {
            const parts = file.path.split(/[/\\]/);
            if (parts.length >= 2) {
                const topDir = parts[0];
                if (!dirMap.has(topDir)) {
                    dirMap.set(topDir, { subdirs: new Set(), fileCount: 0 });
                }
                const entry = dirMap.get(topDir)!;
                entry.fileCount++;
                if (parts.length >= 3) {
                    entry.subdirs.add(parts[1]);
                }
            }
        });

        if (dirMap.size === 0) {
            return '  (no structure detected)';
        }

        const lines: string[] = [];
        const sortedDirs = Array.from(dirMap.keys()).sort();

        for (const dir of sortedDirs) {
            if (lines.length >= ProjectContextBuilder.MAX_TREE_LINES) {
                lines.push('  ... (truncated)');
                break;
            }

            const entry = dirMap.get(dir)!;
            lines.push(`  ${dir}/ (${entry.fileCount} files)`);

            // Show subdirectories (2nd level)
            const sortedSubdirs = Array.from(entry.subdirs).sort();
            for (const subdir of sortedSubdirs) {
                if (lines.length >= ProjectContextBuilder.MAX_TREE_LINES) {
                    lines.push('    ... (truncated)');
                    break;
                }
                lines.push(`    ${subdir}/`);
            }
        }

        return lines.join('\n');
    }

    private formatDependencies(): string {
        const deps = this.projectState.dependencies || {};
        const entries = Object.entries(deps);

        if (entries.length === 0) {
            return '  (no dependencies)';
        }

        // Show key dependencies (limit to 10 most important)
        const keyDeps = entries
            .filter(([name]) => this.isKeyDependency(name))
            .slice(0, 10)
            .map(([name, version]) => `  ${name}: ${version}`)
            .join('\n');

        return keyDeps || '  (no key dependencies)';
    }

    private formatScripts(): string {
        // Try to read scripts from the project state
        // ProjectState doesn't have scripts, so read from package.json via dependencies context
        // For now, show common scripts hint
        const deps = this.projectState.dependencies || {};
        const scripts: string[] = [];

        if (deps['typescript']) scripts.push('build');
        if (deps['jest'] || deps['vitest']) scripts.push('test');
        if (deps['eslint']) scripts.push('lint');
        if (deps['next']) scripts.push('dev', 'build', 'start');
        if (deps['react-scripts']) scripts.push('start', 'build', 'test');

        if (scripts.length === 0) {
            return '  (check package.json for available scripts)';
        }

        return [...new Set(scripts)].map(s => `  npm run ${s}`).join('\n');
    }

    private isKeyDependency(name: string): boolean {
        const keyPackages = [
            'react', 'next', 'vue', 'express', 'fastify',
            'typescript', 'jest', 'vitest', 'tailwindcss',
            '@types/node', '@types/react'
        ];

        return keyPackages.includes(name) || name.startsWith('@types/');
    }

    private formatContext(context: ProjectContext): string {
        const frameworks = this.projectState.frameworks?.length
            ? this.projectState.frameworks.join(', ')
            : context.framework;

        let formatted = `
═══════════════════════════════════════════════════════════════════════════════
PROJECT CONTEXT
═══════════════════════════════════════════════════════════════════════════════

Project: ${context.projectName}
Type: ${context.projectType}
Framework: ${frameworks}
Language: ${context.language}

File Structure:
${context.fileTree}

Key Dependencies:
${context.dependencies}

Available Scripts:
${context.scripts}
`;

        if (context.currentFile) {
            formatted += `\nCurrent File: ${context.currentFile}`;
        }

        if (context.selection) {
            formatted += `\n\nSelected Code:\n\`\`\`\n${context.selection}\n\`\`\``;
        }

        return formatted;
    }
}
