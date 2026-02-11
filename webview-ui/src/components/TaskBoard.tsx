import React from 'react';
import type { TaskGroup, Subtask } from '../types/task-group';
import { SubtaskItem } from './task-group/SubtaskItem';
import { VSCodeButton, VSCodeTag } from '@vscode/webview-ui-toolkit/react';

interface TaskBoardProps {
    taskGroups: TaskGroup[];
    activeGroupId?: string;
    onSelectGroup: (id: string) => void;
    onToggleSubtask: (groupId: string, subtaskId: string, completed: boolean) => void;
    onCreateGroup: () => void;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ taskGroups, activeGroupId, onSelectGroup, onToggleSubtask, onCreateGroup }) => {

    // Group subtasks by status if we have an active group
    const activeGroup = taskGroups.find(g => g.id === activeGroupId) || taskGroups[0];

    if (!activeGroup) {
        return (
            <div className="task-board-empty">
                <div className="empty-content">
                    <h3>No Active Plans</h3>
                    <p>Use <code>/plan [goal]</code> to create a new task plan.</p>
                    <VSCodeButton onClick={onCreateGroup}>Create Plan</VSCodeButton>
                </div>
            </div>
        );
    }

    const todoTasks = activeGroup.subtasks.filter(t => t.status === 'not-started');
    const inProgressTasks = activeGroup.subtasks.filter(t => t.status === 'in-progress');
    const completedTasks = activeGroup.subtasks.filter(t => t.status === 'completed' || t.status === 'skipped');

    return (
        <div className="task-board">
            <div className="task-board-header">
                <div className="group-selector">
                    <label>Plan:</label>
                    <select
                        value={activeGroup.id}
                        onChange={(e) => onSelectGroup(e.target.value)}
                        className="group-select"
                    >
                        {taskGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.title}</option>
                        ))}
                    </select>
                </div>
                <div className="board-actions">
                    <VSCodeButton appearance="icon" onClick={onCreateGroup} title="New Plan">
                        <span className="codicon codicon-add"></span>
                    </VSCodeButton>
                </div>
            </div>

            <div className="kanban-columns">
                <KanbanColumn
                    title="To Do"
                    tasks={todoTasks}
                    count={todoTasks.length}
                    color="var(--vscode-charts-blue)"
                    onToggle={(id, val) => onToggleSubtask(activeGroup.id, id, val)}
                />
                <KanbanColumn
                    title="In Progress"
                    tasks={inProgressTasks}
                    count={inProgressTasks.length}
                    color="var(--vscode-charts-yellow)"
                    onToggle={(id, val) => onToggleSubtask(activeGroup.id, id, val)}
                />
                <KanbanColumn
                    title="Done"
                    tasks={completedTasks}
                    count={completedTasks.length}
                    color="var(--vscode-charts-green)"
                    onToggle={(id, val) => onToggleSubtask(activeGroup.id, id, val)}
                />
            </div>
        </div>
    );
};

const KanbanColumn: React.FC<{
    title: string;
    tasks: Subtask[];
    count: number;
    color: string;
    onToggle: (id: string, val: boolean) => void;
}> = ({ title, tasks, count, color, onToggle }) => (
    <div className="kanban-column">
        <div className="column-header" style={{ borderTopColor: color }}>
            <span className="column-title">{title}</span>
            <VSCodeTag>{count}</VSCodeTag>
        </div>
        <div className="column-content">
            {tasks.map(task => (
                <div key={task.id} className="kanban-card">
                    <SubtaskItem
                        subtask={task}
                        onToggle={(id, completed) => onToggle(id, completed)}
                    />
                </div>
            ))}
            {tasks.length === 0 && <div className="empty-column-placeholder">No tasks</div>}
        </div>
    </div>
);
