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

export class GitAddTool implements Tool {
    name = 'git_add';
    description = 'Stage files for commit.';
    parameters = {
        type: 'object',
        properties: {
            files: { type: 'array', items: { type: 'string' }, description: 'Files to add (use ["."] for all)' }
        },
        required: ['files']
    };
    private git: SimpleGit;

    constructor(private workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    async execute(args: any): Promise<string> {
        try {
            const files = args?.files || ['.'];
            await this.git.add(files);
            return `Staged files: ${files.join(', ')}`;
        } catch (error: any) {
            return `Error adding files: ${error.message}`;
        }
    }
}

export class GitCommitTool implements Tool {
    name = 'git_commit';
    description = 'Commit staged changes.';
    parameters = {
        type: 'object',
        properties: {
            message: { type: 'string', description: 'Commit message' }
        },
        required: ['message']
    };
    requiresConfirmation = true;
    private git: SimpleGit;

    constructor(private workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    async execute(args: any): Promise<string> {
        try {
            const message = args?.message;
            if (!message) return 'Error: Commit message required';

            const result = await this.git.commit(message);
            return `Committed: ${result.summary.changes} changes. Hash: ${result.commit}`;
        } catch (error: any) {
            return `Error committing: ${error.message}`;
        }
    }
}

export class GitPushTool implements Tool {
    name = 'git_push';
    description = 'Push commits to remote.';
    parameters = {
        type: 'object',
        properties: {
            remote: { type: 'string', description: 'Remote name (default: origin)' },
            branch: { type: 'string', description: 'Branch name (default: current)' }
        },
        required: []
    };
    requiresConfirmation = true;
    private git: SimpleGit;

    constructor(private workspaceRoot: string) {
        this.git = simpleGit(workspaceRoot);
    }

    async execute(args: any): Promise<string> {
        try {
            const remote = args?.remote || 'origin';
            const branch = args?.branch; // if undefined, pushes current

            if (branch) {
                await this.git.push(remote, branch);
            } else {
                await this.git.push(remote);
            }
            return `Pushed to ${remote}/${branch || 'current'}`;
        } catch (error: any) {
            return `Error pushing: ${error.message}`;
        }
    }
}
