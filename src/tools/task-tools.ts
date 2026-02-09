import { Tool } from './tool-interface';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TaskGroupManager } from '../agent/task-group-manager';

export class TaskTools {
    constructor(private taskGroupManager: TaskGroupManager) { }

    public getTools(): Tool[] {
        return [
            {
                name: 'create_task_group',
                description: 'Create a new task group (plan) with subtasks. This should be used for complex multi-step tasks. Opens task.md preview in VS Code.',
                parameters: {
                    type: 'object',
                    properties: {
                        goal: { type: 'string', description: 'The overall goal of the task group' }
                    },
                    required: ['goal']
                },
                execute: async (args: { goal: string }) => {
                    const title = args.goal.length > 40 ? args.goal.substring(0, 37) + '...' : args.goal;
                    const group = await this.taskGroupManager.create(title, args.goal);

                    // Open task.md automatically in preview mode
                    try {
                        const taskPath = this.taskGroupManager.getRootTaskPath();
                        const uri = vscode.Uri.file(taskPath);
                        await vscode.commands.executeCommand('markdown.showPreview', uri);
                    } catch (e) {
                        console.error('[TaskTools] Failed to open task.md preview:', e);
                    }

                    return `Success: Task group created. The "task.md" file is now open in preview mode. Your FINAL response to the user must be exactly: "Task plan created. Review task.md and type continue to proceed."`;
                }
            },
            {
                name: 'create_implementation_plan',
                description: 'Create a detailed, step-by-step engineering implementation plan in "implement-task.md". Use this AFTER the user has approved the high-level task.md plan. Opens the file in editor.',
                parameters: {
                    type: 'object',
                    properties: {
                        plan_details: {
                            type: 'object',
                            description: 'The detailed plan sections',
                            properties: {
                                task: { type: 'string', description: 'Overall task name' },
                                status: { type: 'string', description: 'Current status (e.g. Planning)' },
                                assumptions: { type: 'string', description: 'Assumptions made' },
                                execution_steps: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            action: { type: 'string' },
                                            files: { type: 'array', items: { type: 'string' } },
                                            commands: { type: 'array', items: { type: 'string' } },
                                            expected_results: { type: 'string' }
                                        }
                                    }
                                },
                                verification_checklist: { type: 'array', items: { type: 'string' } }
                            }
                        }
                    },
                    required: ['plan_details']
                },
                execute: async (args: { plan_details: any }) => {
                    const d = args.plan_details;
                    const steps = d.execution_steps || [];
                    const checklist = d.verification_checklist || [];

                    const content = `# Implementation Plan: ${d.task || 'Untitled Task'}

## Status
${d.status || 'Planning'}

## Assumptions
${d.assumptions || 'N/A'}

## Execution Steps
${steps.map((s: any, i: number) => `
### Step ${i + 1}: ${s.action || 'Untitled Step'}
- **Files**: ${s.files?.join(', ') || 'N/A'}
- **Commands**: ${s.commands?.join(', ') || 'N/A'}
- **Expected Results**: ${s.expected_results || 'N/A'}`).join('\n')}

## Verification Checklist
${checklist.map((v: string) => `- [ ] ${v}`).join('\n')}
`;
                    try {
                        const root = this.taskGroupManager.getWorkspaceRoot();
                        const filePath = path.join(root, 'implement-task.md');
                        await fs.promises.writeFile(filePath, content, 'utf-8');

                        const uri = vscode.Uri.file(filePath);
                        await vscode.commands.executeCommand('vscode.open', uri);
                    } catch (e) {
                        console.error('[TaskTools] Failed to create implement-task.md:', e);
                    }

                    return `Success: Implementation plan created. Your FINAL response to the user must be exactly: "Implementation plan created. Execution will begin."`;
                }
            }
        ];
    }
}
