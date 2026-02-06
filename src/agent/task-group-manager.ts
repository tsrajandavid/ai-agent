import { v4 as uuidv4 } from 'uuid';
import { TaskGroup, Subtask, ProgressUpdate, TaskGroupStorage } from './task-group-types';

import { MarkdownMirror } from './markdown-mirror';

export class TaskGroupManager {
    private markdownMirror: MarkdownMirror;

    constructor(
        private storage: TaskGroupStorage,
        workspaceRoot: string
    ) {
        this.markdownMirror = new MarkdownMirror(workspaceRoot);
    }

    async create(title: string, goal: string): Promise<TaskGroup> {
        const group: TaskGroup = {
            id: uuidv4(),
            title,
            description: goal,
            status: 'not-started',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            subtasks: [],
            progress: [{
                timestamp: Date.now(),
                message: `Task group created: ${title}`,
                type: 'info'
            }]
        };

        await this.save(group);
        return group;
    }

    async get(id: string): Promise<TaskGroup | undefined> {
        return this.storage.get(id);
    }

    async getAll(): Promise<TaskGroup[]> {
        return this.storage.getAll();
    }

    async updateStatus(id: string, status: TaskGroup['status']): Promise<void> {
        const group = await this.get(id);
        if (!group) throw new Error(`Task group ${id} not found`);

        group.status = status;
        group.updatedAt = Date.now();
        await this.save(group);
    }

    async addSubtask(groupId: string, subtask: Omit<Subtask, 'id' | 'status'>): Promise<Subtask> {
        const group = await this.get(groupId);
        if (!group) throw new Error(`Task group ${groupId} not found`);

        const newSubtask: Subtask = {
            id: uuidv4(),
            status: 'not-started',
            ...subtask
        };

        group.subtasks.push(newSubtask);
        group.updatedAt = Date.now();

        // Auto-start group if not started
        if (group.status === 'not-started') {
            group.status = 'in-progress';
        }

        await this.save(group);
        return newSubtask;
    }

    async updateSubtaskStatus(groupId: string, subtaskId: string, status: Subtask['status']): Promise<void> {
        const group = await this.get(groupId);
        if (!group) throw new Error(`Task group ${groupId} not found`);

        const subtask = group.subtasks.find(s => s.id === subtaskId);
        if (!subtask) throw new Error(`Subtask ${subtaskId} not found`);

        subtask.status = status;
        group.updatedAt = Date.now();

        // Check if all subtasks are complete
        if (group.subtasks.every(s => s.status === 'completed' || s.status === 'skipped')) {
            group.status = 'completed';
            if (group.subtasks.every(s => s.status === 'completed' || s.status === 'skipped')) {
                group.status = 'completed';

                // Add progress directly to avoid re-fetching stale data
                group.progress.push({
                    timestamp: Date.now(),
                    message: 'All subtasks completed. Task group marked as completed.',
                    type: 'success'
                });
            }

            await this.save(group);
        }

    async addProgress(groupId: string, update: Omit<ProgressUpdate, 'timestamp'>): Promise < void> {
            const group = await this.get(groupId);
            if(!group) throw new Error(`Task group ${groupId} not found`);

            group.progress.push({
                timestamp: Date.now(),
                ...update
            });
            group.updatedAt = Date.now();

            await this.save(group);
        }

    async delete (id: string): Promise < void> {
            await this.storage.delete(id);
            await this.markdownMirror.delete(id);
        }

    private async save(group: TaskGroup): Promise<void> {
        await this.storage.save(group);
        await this.markdownMirror.sync(group);
    }
}
