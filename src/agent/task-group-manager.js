"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskGroupManager = void 0;
const uuid_1 = require("uuid");
const markdown_mirror_1 = require("./markdown-mirror");
class TaskGroupManager {
    constructor(storage, workspaceRoot) {
        this.storage = storage;
        this.markdownMirror = new markdown_mirror_1.MarkdownMirror(workspaceRoot);
    }
    async create(title, goal) {
        const group = {
            id: (0, uuid_1.v4)(),
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
    async get(id) {
        return this.storage.get(id);
    }
    async getAll() {
        return this.storage.getAll();
    }
    async updateStatus(id, status) {
        const group = await this.get(id);
        if (!group)
            throw new Error(`Task group ${id} not found`);
        group.status = status;
        group.updatedAt = Date.now();
        await this.save(group);
    }
    async addSubtask(groupId, subtask) {
        const group = await this.get(groupId);
        if (!group)
            throw new Error(`Task group ${groupId} not found`);
        const newSubtask = {
            id: (0, uuid_1.v4)(),
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
    async updateSubtaskStatus(groupId, subtaskId, status) {
        const group = await this.get(groupId);
        if (!group)
            throw new Error(`Task group ${groupId} not found`);
        const subtask = group.subtasks.find(s => s.id === subtaskId);
        if (!subtask)
            throw new Error(`Subtask ${subtaskId} not found`);
        subtask.status = status;
        group.updatedAt = Date.now();
        // Check if all subtasks are complete
        if (group.subtasks.every(s => s.status === 'completed' || s.status === 'skipped')) {
            group.status = 'completed';
            this.addProgress(groupId, {
                message: 'All subtasks completed. Task group marked as completed.',
                type: 'success'
            });
        }
        await this.save(group);
    }
    async addProgress(groupId, update) {
        const group = await this.get(groupId);
        if (!group)
            throw new Error(`Task group ${groupId} not found`);
        group.progress.push({
            timestamp: Date.now(),
            ...update
        });
        group.updatedAt = Date.now();
        await this.save(group);
    }
    async delete(id) {
        await this.storage.delete(id);
        await this.markdownMirror.delete(id);
    }
    async save(group) {
        await this.storage.save(group);
        await this.markdownMirror.sync(group);
    }
}
exports.TaskGroupManager = TaskGroupManager;
