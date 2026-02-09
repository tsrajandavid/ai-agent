import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { EventEmitter } from 'events';
import { TaskGroup, Subtask, ProgressUpdate, TaskGroupStorage } from './task-group-types';
import { LLMService } from '../llm/llm-service';
import { MarkdownMirror } from './markdown-mirror';
import { JSONParser } from '../utilities/json-parser';

export class TaskGroupManager extends EventEmitter {
    private markdownMirror: MarkdownMirror;

    constructor(
        private storage: TaskGroupStorage,
        private llm: LLMService,
        private workspaceRoot: string
    ) {
        super();
        this.markdownMirror = new MarkdownMirror(workspaceRoot);
    }

    public getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    async generateSubtasks(goal: string): Promise<Subtask[]> {
        const systemPrompt = `You are a world-class software architect and project manager. 
Your goal is to break down high-level user requests into clear, actionable subtasks.
You MUST respond with a raw JSON array of objects. No intro text, no conversational filler.

Each subtask object must contain:
- title: string (short, actionable)
- description: string (detailed steps)
- assignedFiles: string[] (optional list of files involved)

Example:
[
  {
    "title": "Define project structure",
    "description": "Initialize folder structure and basic configuration files.",
    "assignedFiles": ["package.json"]
  }
]`;

        const userPrompt = `Break down the following goal into a list of 4-8 concrete subtasks: "${goal}"`;

        try {
            const response = await this.llm.sendRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]);

            console.log('[TaskGroupManager] Subtask generation response received, length:', response.length);

            let strategies: any[];
            try {
                strategies = JSONParser.parse<any[]>(response);
            } catch (e) {
                console.error('[TaskGroupManager] JSON extraction failed:', e);
                console.log('[TaskGroupManager] Raw response for debugging:', response);
                throw e;
            }

            if (!Array.isArray(strategies)) {
                console.error('[TaskGroupManager] Extracted JSON is not an array:', strategies);
                throw new Error('LLM response is not an array');
            }

            return strategies.map(s => ({
                id: uuidv4(),
                title: s.title || 'Untitled Task',
                description: s.description || '',
                status: 'not-started',
                assignedFiles: s.assignedFiles || []
            }));

        } catch (error) {
            console.error('Failed to generate subtasks:', error);
            // Fallback to a single generic subtask on failure
            return [{
                id: uuidv4(),
                title: 'Analyze and implement goal',
                description: 'Manual breakdown required due to generation failure',
                status: 'not-started'
            }];
        }
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

        // Try to auto-generate subtasks if goal is substantial
        if (goal.length > 20) {
            try {
                const subtasks = await this.generateSubtasks(goal);
                group.subtasks = subtasks;
                group.progress.push({
                    timestamp: Date.now(),
                    message: `Auto-generated ${subtasks.length} subtasks using AI`,
                    type: 'success'
                });
            } catch (e) {
                console.warn('Auto-generation skipped:', e);
            }
        }

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

        // Log progress
        let type: ProgressUpdate['type'] = 'info';
        if (status === 'completed') type = 'success';
        if (status === 'skipped') type = 'warning';

        group.progress.push({
            timestamp: Date.now(),
            message: `Subtask "${subtask.title}" marked as ${status}`,
            type,
            subtaskId
        });

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
    }

    async addProgress(groupId: string, update: Omit<ProgressUpdate, 'timestamp'>): Promise<void> {
        const group = await this.get(groupId);
        if (!group) throw new Error(`Task group ${groupId} not found`);

        group.progress.push({
            timestamp: Date.now(),
            ...update
        });
        group.updatedAt = Date.now();

        await this.save(group);
    }

    async delete(id: string): Promise<void> {
        await this.storage.delete(id);
        await this.markdownMirror.delete(id);
    }

    public getRootTaskPath(): string {
        return path.join(this.workspaceRoot, 'task.md');
    }

    private async save(group: TaskGroup): Promise<void> {
        await this.storage.save(group);
        await this.markdownMirror.sync(group);
        this.emit('tasks-updated', group);
    }
    async setAutoStatus(id: string, isAutoRunning: boolean): Promise<void> {
        const group = await this.get(id);
        if (group) {
            group.isAutoRunning = isAutoRunning;
            group.updatedAt = Date.now();
            await this.storage.save(group);
            // Notify via callback if needed, but for now just saving state
        }
    }
}
