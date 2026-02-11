import { TaskGroupManager } from './task-group-manager';
import { LLMService } from '../llm/llm-service';
import { EventEmitter } from 'events';

export interface StepEvent {
    groupId: string;
    subtaskId: string;
    title: string;
    status: 'started' | 'completed' | 'failed' | 'retrying';
    attempt?: number;
}

const MAX_RETRIES = 2;

export class ActionEngine extends EventEmitter {
    private _isPaused = false;

    constructor(
        private readonly _taskGroupManager: TaskGroupManager,
        _llmService: LLMService,
        private readonly _runAgentLoop: (prompt: string) => Promise<boolean>
    ) {
        super();
    }

    public get isPaused(): boolean {
        return this._isPaused;
    }

    public stop() {
        this._isPaused = true;
        this.emit('status-changed', { running: false, reason: 'paused' });
    }

    public resume() {
        this._isPaused = false;
        this.emit('status-changed', { running: true, reason: 'resumed' });
    }

    public async executeNextStep(groupId: string): Promise<boolean> {
        if (this._isPaused) return false;

        const group = await this._taskGroupManager.get(groupId);
        if (!group) return false;

        const nextTask = group.subtasks.find(t => t.status === 'not-started');
        if (!nextTask) return false;

        console.log(`[ActionEngine] Executing subtask: ${nextTask.title}`);

        await this._taskGroupManager.updateSubtaskStatus(groupId, nextTask.id, 'in-progress');

        const stepEvent: StepEvent = {
            groupId,
            subtaskId: nextTask.id,
            title: nextTask.title,
            status: 'started'
        };
        this.emit('step-start', stepEvent);

        const prompt = `
Context: Implementing a plan to "${group.description}".
Current Task: ${nextTask.title}.
Task Description: ${nextTask.description || 'No additional details.'}

Please execute this task. Use the available tools to create files, run commands, or analyze code as needed.
When the task is complete, or if you cannot complete it, stop.
`;

        let success = false;
        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            if (this._isPaused) break;

            if (attempt > 1) {
                console.log(`[ActionEngine] Retry attempt ${attempt} for: ${nextTask.title}`);
                this.emit('step-retry', { ...stepEvent, status: 'retrying', attempt });
                await this._taskGroupManager.addProgress(groupId, {
                    message: `Retrying "${nextTask.title}" (attempt ${attempt})`,
                    type: 'warning',
                    subtaskId: nextTask.id
                });
            }

            try {
                success = await this._runAgentLoop(prompt);
                if (success) break;
            } catch (e) {
                lastError = e;
                console.error(`[ActionEngine] Attempt ${attempt} failed:`, e);
            }
        }

        if (success) {
            await this._taskGroupManager.updateSubtaskStatus(groupId, nextTask.id, 'completed');
            this.emit('step-complete', { ...stepEvent, status: 'completed' });
            return true;
        } else {
            const reason = lastError instanceof Error ? lastError.message : 'Execution failed';
            await this._taskGroupManager.updateSubtaskStatus(groupId, nextTask.id, 'failed');
            await this._taskGroupManager.addProgress(groupId, {
                message: `Failed: "${nextTask.title}" — ${reason}`,
                type: 'error',
                subtaskId: nextTask.id
            });
            await this._taskGroupManager.setAutoStatus(groupId, false);
            this.emit('step-failed', { ...stepEvent, status: 'failed' });
            this.stop();
            return false;
        }
    }
}
