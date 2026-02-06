import * as fs from 'fs';
import * as path from 'path';
import { ProjectState } from '../services/project-indexer';

export interface CodeConventions {
    indentation: string;
    quotes: string;
    semicolons: string;
    componentStyle: string;
}

export interface ProjectContext {
    projectName: string;
    projectType: string;
    framework: string;
    language: string;
    fileTree: string;
    dependencies: string;
    scripts: string;
    conventions: string;
    currentFile?: string;
    selection?: string;
}

export class ProjectContextBuilder {
    constructor(
        private readonly projectState: ProjectState,
        private readonly workspaceRoot?: string
    ) { }

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
            conventions: this.detectConventions(),
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

    private detectConventions(): string {
        if (!this.workspaceRoot) {
            return '  (unable to detect - no workspace root)';
        }

        const conventions = this.analyzeCodeConventions();
        const lines: string[] = [];

        lines.push(`  Indentation: ${conventions.indentation}`);
        lines.push(`  Quotes: ${conventions.quotes}`);
        lines.push(`  Semicolons: ${conventions.semicolons}`);
        lines.push(`  Components: ${conventions.componentStyle}`);

        return lines.join('\n');
    }

    private analyzeCodeConventions(): CodeConventions {
        const result: CodeConventions = {
            indentation: 'unknown',
            quotes: 'unknown',
            semicolons: 'unknown',
            componentStyle: 'unknown'
        };

        // Check for config files first (fastest and most reliable)
        result.indentation = this.detectIndentation();
        result.quotes = this.detectQuoteStyle();
        result.semicolons = this.detectSemicolons();
        result.componentStyle = this.detectComponentStyle();

        return result;
    }

    private detectIndentation(): string {
        if (!this.workspaceRoot) return 'unknown';

        // Check .editorconfig
        const editorConfigPath = path.join(this.workspaceRoot, '.editorconfig');
        if (fs.existsSync(editorConfigPath)) {
            try {
                const content = fs.readFileSync(editorConfigPath, 'utf-8');
                if (content.includes('indent_style = tab')) return 'tabs';
                if (content.includes('indent_size = 2')) return '2 spaces';
                if (content.includes('indent_size = 4')) return '4 spaces';
            } catch { /* ignore */ }
        }

        // Check .prettierrc
        const prettierPaths = ['.prettierrc', '.prettierrc.json', '.prettierrc.js'];
        for (const p of prettierPaths) {
            const fullPath = path.join(this.workspaceRoot, p);
            if (fs.existsSync(fullPath)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    if (content.includes('"useTabs": true') || content.includes('useTabs: true')) return 'tabs';
                    if (content.includes('"tabWidth": 2') || content.includes('tabWidth: 2')) return '2 spaces';
                    if (content.includes('"tabWidth": 4') || content.includes('tabWidth: 4')) return '4 spaces';
                } catch { /* ignore */ }
            }
        }

        // Sample a source file
        const sampleFile = this.findSampleFile(['.ts', '.tsx', '.js', '.jsx']);
        if (sampleFile) {
            try {
                const content = fs.readFileSync(sampleFile, 'utf-8');
                const lines = content.split('\n').filter(l => l.startsWith(' ') || l.startsWith('\t'));
                if (lines.length > 0) {
                    if (lines[0].startsWith('\t')) return 'tabs';
                    const match = lines[0].match(/^( +)/);
                    if (match) {
                        return match[1].length <= 2 ? '2 spaces' : '4 spaces';
                    }
                }
            } catch { /* ignore */ }
        }

        return '2 spaces';
    }

    private detectQuoteStyle(): string {
        const sampleFile = this.findSampleFile(['.ts', '.tsx', '.js', '.jsx']);
        if (!sampleFile) return 'single quotes';

        try {
            const content = fs.readFileSync(sampleFile, 'utf-8');
            const singleCount = (content.match(/'/g) || []).length;
            const doubleCount = (content.match(/"/g) || []).length;
            return singleCount >= doubleCount ? 'single quotes' : 'double quotes';
        } catch {
            return 'single quotes';
        }
    }

    private detectSemicolons(): string {
        const sampleFile = this.findSampleFile(['.ts', '.tsx', '.js', '.jsx']);
        if (!sampleFile) return 'yes';

        try {
            const content = fs.readFileSync(sampleFile, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
            const withSemicolon = lines.filter(l => l.trimEnd().endsWith(';')).length;
            return withSemicolon > lines.length * 0.3 ? 'yes' : 'no';
        } catch {
            return 'yes';
        }
    }

    private detectComponentStyle(): string {
        const deps = this.projectState.dependencies || {};
        if (!deps['react']) return 'N/A';

        // Check for common patterns
        const sampleFile = this.findSampleFile(['.tsx', '.jsx']);
        if (!sampleFile) return 'functional';

        try {
            const content = fs.readFileSync(sampleFile, 'utf-8');
            if (content.includes('extends Component') || content.includes('extends React.Component')) {
                return 'class components';
            }
            return 'functional components';
        } catch {
            return 'functional components';
        }
    }

    private findSampleFile(extensions: string[]): string | null {
        if (!this.workspaceRoot) return null;

        // Look for a source file to sample conventions from
        const srcDir = path.join(this.workspaceRoot, 'src');
        const searchDirs = fs.existsSync(srcDir) ? [srcDir] : [this.workspaceRoot];

        for (const dir of searchDirs) {
            try {
                const files = fs.readdirSync(dir, { withFileTypes: true });
                for (const file of files) {
                    if (file.isFile() && extensions.some(ext => file.name.endsWith(ext))) {
                        return path.join(dir, file.name);
                    }
                    // Check one level deep
                    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
                        try {
                            const subFiles = fs.readdirSync(path.join(dir, file.name), { withFileTypes: true });
                            for (const sf of subFiles) {
                                if (sf.isFile() && extensions.some(ext => sf.name.endsWith(ext))) {
                                    return path.join(dir, file.name, sf.name);
                                }
                            }
                        } catch { /* ignore */ }
                    }
                }
            } catch { /* ignore */ }
        }

        return null;
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

Code Conventions:
${context.conventions}
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
