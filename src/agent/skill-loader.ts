import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { ProjectState } from '../services/project-indexer';

export interface SkillMetadata {
    name: string;
    description: string;
}

export interface Skill {
    metadata: SkillMetadata;
    content: string;
    filePath: string;
}

export interface SkillContext {
    dependencies: Record<string, string>;
    hasTypeScript: boolean;
    files: string[];
}

/**
 * Loads all skills from .agent/skills/ directory
 */
export class SkillLoader {
    private skills: Skill[] = [];
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.loadSkills();
    }

    private loadSkills(): void {
        const skillsDir = path.join(this.workspaceRoot, '.agent', 'skills');

        if (!fs.existsSync(skillsDir)) {
            console.log('[Skills] No .agent/skills directory found');
            return;
        }

        try {
            const skillFolders = fs.readdirSync(skillsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            for (const folder of skillFolders) {
                const skillFile = path.join(skillsDir, folder, 'SKILL.md');

                if (fs.existsSync(skillFile)) {
                    try {
                        const content = fs.readFileSync(skillFile, 'utf-8');
                        const { data, content: markdownContent } = matter(content);

                        this.skills.push({
                            metadata: {
                                name: data.name || folder,
                                description: data.description || 'No description'
                            },
                            content: markdownContent,
                            filePath: skillFile
                        });

                        console.log(`[Skills] ✓ Loaded skill: ${data.name || folder}`);
                    } catch (error) {
                        console.error(`[Skills] Failed to load ${skillFile}:`, error);
                    }
                }
            }

            console.log(`[Skills] Loaded ${this.skills.length} skills total`);
        } catch (error) {
            console.error('[Skills] Error loading skills:', error);
        }
    }

    /**
     * Get all loaded skills
     */
    public getAllSkills(): Skill[] {
        return this.skills;
    }

    /**
     * Get active skills based on project context
     */
    public getActiveSkills(projectState: ProjectState): Skill[] {
        const context: SkillContext = {
            dependencies: projectState.dependencies || {},
            hasTypeScript: projectState.files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx')),
            files: projectState.files.map(f => f.path)
        };

        const activeSkills = this.skills.filter(skill => {
            return this.shouldActivateSkill(skill, context);
        });

        // Cap to MAX_SKILLS to prevent prompt bloat
        const capped = activeSkills.slice(0, SkillLoader.MAX_SKILLS);

        if (capped.length > 0) {
            console.log(`[Skills] Active skills (${capped.length}/${activeSkills.length}):`, capped.map(s => s.metadata.name).join(', '));
        }

        return capped;
    }

    private static readonly MAX_SKILLS = 6;

    /**
     * Determine if a skill should be activated based on context
     */
    private shouldActivateSkill(skill: Skill, context: SkillContext): boolean {
        const name = skill.metadata.name.toLowerCase();

        // TypeScript skill — only when project has TS files
        if (name.includes('typescript')) {
            return context.hasTypeScript;
        }

        // React skill — only when react is a dependency
        if (name.includes('react')) {
            return context.dependencies['react'] !== undefined;
        }

        // Next.js skill — only when next is a dependency
        if (name.includes('next')) {
            return context.dependencies['next'] !== undefined;
        }

        // Tailwind skill — only when tailwindcss is a dependency
        if (name.includes('tailwind')) {
            return context.dependencies['tailwindcss'] !== undefined;
        }

        // API design skill — only when a backend framework is present
        if (name.includes('api')) {
            const apiDeps = ['express', 'fastify', 'koa', 'hapi', '@nestjs/core'];
            return apiDeps.some(dep => context.dependencies[dep] !== undefined);
        }

        // Database skill — only when a DB library is present
        if (name.includes('database')) {
            const dbDeps = ['prisma', 'mongoose', 'typeorm', 'pg', 'mysql', 'sqlite3', 'mongodb', 'sequelize'];
            return dbDeps.some(dep => context.dependencies[dep] !== undefined);
        }

        // Testing skill — only when a test framework is present
        if (name.includes('test')) {
            const testDeps = ['jest', 'vitest', 'mocha', 'cypress', 'chai', 'supertest'];
            return testDeps.some(dep => context.dependencies[dep] !== undefined);
        }

        // Meta-skills: always active (git, planning, refactoring, documentation, debugging, code-review, performance)
        if (name.includes('git') || name.includes('workflow')) {
            return true;
        }
        if (name.includes('planning') || name.includes('refactoring') || name.includes('documentation') || name.includes('debug')) {
            return true;
        }
        if (name.includes('code-review') || name.includes('performance')) {
            return true;
        }

        // Unknown skills: do not activate by default
        console.log(`[Skills] ⚠ Unknown skill "${name}" — not activated`);
        return false;
    }

    /**
     * Format skills for system prompt
     */
    public formatSkillsForPrompt(skills: Skill[]): string {
        if (skills.length === 0) {
            return '';
        }

        const skillSections = skills.map(skill => {
            return `═══════════════════════════════════════════════════════════════════════════════
SKILL: ${skill.metadata.name.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════

${skill.content}`;
        });

        return skillSections.join('\n\n');
    }

    /**
     * Reload skills (useful for development)
     */
    public reload(): void {
        this.skills = [];
        this.loadSkills();
    }
}

/**
 * Get active skills for system prompt (backward compatible)
 */
export function getActiveSkills(projectState: ProjectState, workspaceRoot: string): string[] {
    const loader = new SkillLoader(workspaceRoot);
    const activeSkills = loader.getActiveSkills(projectState);

    // Return formatted skill content
    return activeSkills.map(skill => {
        return `═══════════════════════════════════════════════════════════════════════════════
SKILL: ${skill.metadata.name.toUpperCase()}
═══════════════════════════════════════════════════════════════════════════════

${skill.content}`;
    });
}
