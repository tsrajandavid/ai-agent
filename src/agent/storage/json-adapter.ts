import * as path from 'path';
import * as fs from 'fs';
import { TaskGroup, TaskGroupStorage } from '../task-group-types';

export class JSONAdapter implements TaskGroupStorage {
    private dataFile: string;
    private data: Record<string, TaskGroup> = {};
    private loaded: boolean = false;

    constructor(workspaceRoot: string) {
        const dataDir = path.join(workspaceRoot, '.agent', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.dataFile = path.join(dataDir, 'task-groups.json');
    }

    private async ensureLoaded() {
        if (this.loaded) return;

        try {
            if (fs.existsSync(this.dataFile)) {
                const content = await fs.promises.readFile(this.dataFile, 'utf-8');
                this.data = JSON.parse(content);
            } else {
                this.data = {};
            }
        } catch (error) {
            console.error('[JSONAdapter] Failed to load data:', error);
            this.data = {};
        }
        this.loaded = true;
    }

    private async flush() {
        try {
            await fs.promises.writeFile(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[JSONAdapter] Failed to save data:', error);
        }
    }

    async save(taskGroup: TaskGroup): Promise<void> {
        await this.ensureLoaded();
        this.data[taskGroup.id] = taskGroup;
        await this.flush();
    }

    async get(id: string): Promise<TaskGroup | undefined> {
        await this.ensureLoaded();
        return this.data[id];
    }

    async getAll(): Promise<TaskGroup[]> {
        await this.ensureLoaded();
        return Object.values(this.data).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async delete(id: string): Promise<void> {
        await this.ensureLoaded();
        if (this.data[id]) {
            delete this.data[id];
            await this.flush();
        }
    }
}
