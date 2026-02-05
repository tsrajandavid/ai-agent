import { Tool } from './tool-interface';
import simpleGit, { SimpleGit } from 'simple-git';

export class GitStatusTool implements Tool {
    name = 'git_status';
    description = 'Get the status of the git repository.';
    parameters = {
        type: 'object',
        properties: {},
        required: []
    };
    private git: SimpleGit;

    constructor(private workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    async execute(_args: any): Promise<string> {
        try {
            const status = await this.git.status();
            return JSON.stringify(status, null, 2);
        } catch (error: any) {
            return `Error getting git status: ${error.message}`;
        }
    }
}

export class GitDiffTool implements Tool {
    name = 'git_diff';
    description = 'Get the diff of the git repository.';
    parameters = {
        type: 'object',
        properties: {},
        required: []
    };
    private git: SimpleGit;

    constructor(private workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    async execute(_args: any): Promise<string> {
        try {
            const diff = await this.git.diff();
            return diff || 'No changes.';
        } catch (error: any) {
            return `Error getting git diff: ${error.message}`;
        }
    }
}

export class GitLogTool implements Tool {
    name = 'git_log';
    description = 'Get the recent git log.';
    parameters = {
        type: 'object',
        properties: {
            count: { type: 'number', description: 'Number of commits to show (default: 10)' }
        },
        required: []
    };
    private git: SimpleGit;

    constructor(private workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    async execute(_args: any): Promise<string> {
        try {
            const log = await this.git.log({ maxCount: 10 });
            return JSON.stringify(log.all, null, 2);
        } catch (error: any) {
            return `Error getting git log: ${error.message}`;
        }
    }
}
