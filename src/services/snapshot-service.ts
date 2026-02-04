import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class SnapshotService {
    private snapshotDir: string;

    constructor(private workspaceRoot: string) {
        this.snapshotDir = path.join(workspaceRoot, '.ai-agent', 'snapshots');
    }

    public async createSnapshot(name: string): Promise<string> {
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const snapshotName = `${timestamp}_${name}`;
        const destDir = path.join(this.snapshotDir, snapshotName);

        try {
            // Simple recursive copy, excluding .git, node_modules, and .ai-agent
            await this.copyRecursive(this.workspaceRoot, destDir);
            return `Snapshot '${snapshotName}' created successfully.`;
        } catch (error: any) {
            throw new Error(`Failed to create snapshot: ${error.message}`);
        }
    }

    public async listSnapshots(): Promise<string[]> {
        if (!fs.existsSync(this.snapshotDir)) {
            return [];
        }
        return fs.readdirSync(this.snapshotDir);
    }

    public async restoreSnapshot(snapshotName: string): Promise<void> {
        const sourceDir = path.join(this.snapshotDir, snapshotName);
        if (!fs.existsSync(sourceDir)) {
            throw new Error(`Snapshot '${snapshotName}' not found.`);
        }

        // Implementation of restore is tricky as it involves overwriting files.
        // For safety/MVP, we might just expose where it is, or do a careful copy.
        // Let's stick to creating snapshots for safety first.
        throw new Error("Restore not yet implemented for safety reasons.");
    }

    private async copyRecursive(src: string, dest: string) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            // Exclusions
            if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.ai-agent' || entry.name === 'out' || entry.name === 'dist') {
                continue;
            }

            if (entry.isDirectory()) {
                await this.copyRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
