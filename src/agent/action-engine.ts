import * as vscode from 'vscode';
import { TaskGroupManager } from './task-group-manager';
import { LLMService } from '../llm/llm-service';

export class ActionEngine {
    private _isPaused = false;

    constructor(
        private readonly _taskGroupManager: TaskGroupManager,
        private readonly _llmService: LLMService,
        private readonly _runAgentLoop: (prompt: string) => Promise<boolean>
    ) { }

    public stop() {
        this._isPaused = true;
    }

    public resume() {
        this._isPaused = false;
    }

    public async executeNextStep(groupId: string): Promise<boolean> {
        if (this._isPaused) return false;

        const group = await this._taskGroupManager.get(groupId);
        if (!group) return false;

        // Find next pending subtask
        const nextTask = group.subtasks.find(t => t.status === 'not-started');
        if (!nextTask) return false; // All done or none pending

        console.log(`[ActionEngine] Executing subtask: ${nextTask.title}`);

        // Mark as in-progress
        await this._taskGroupManager.updateSubtaskStatus(groupId, nextTask.id, 'in-progress');

        // Construct prompt
        const prompt = `
Context: Implementing a plan to "${group.description}".
Current Task: ${nextTask.title}.
Task Description: ${nextTask.description || 'No additional details.'}

Please execute this task. Use the available tools to create files, run commands, or analyze code as needed.
When the task is complete, or if you cannot complete it, stop.
`;

        // Run agent loop for this task
        // We expect _runAgentLoop to return true if the loop completed successfully (tool calls worked), false otherwise.
        const success = await this._runAgentLoop(prompt);

        // Update status based on result
        if (success) {
            await this._taskGroupManager.updateSubtaskStatus(groupId, nextTask.id, 'completed');
            return true; // value to continue loop
        } else {
            // Failed or user cancelled?
            await this._taskGroupManager.updateSubtaskStatus(groupId, nextTask.id, 'failed');
            // Also unset auto status since we are stopping
            await this._taskGroupManager.setAutoStatus(groupId, false);
            this.stop(); // Stop on failure
            return false;
        }
    }
}
