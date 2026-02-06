import React from 'react';
import type { TaskGroup } from '../../types/task-group';
import { SubtaskItem } from './SubtaskItem';
import { ProgressTimeline } from './ProgressTimeline';
import { VSCodeButton, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';

interface TaskGroupPanelProps {
    taskGroup: TaskGroup | null;
    onCreateGroup?: () => void;
    onToggleSubtask?: (id: string, completed: boolean) => void;
}

export const TaskGroupPanel: React.FC<TaskGroupPanelProps> = ({ taskGroup, onCreateGroup, onToggleSubtask }) => {
    if (!taskGroup) {
        return (
            <div style={{ padding: '16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--vscode-descriptionForeground)', marginBottom: '16px' }}>
                    No active task group.
                </p>
                <VSCodeButton onClick={onCreateGroup}>
                    Create Task Group
                </VSCodeButton>
            </div>
        );
    }

    const completedCount = taskGroup.subtasks.filter(s => s.status === 'completed' || s.status === 'skipped').length;
    const totalCount = taskGroup.subtasks.length;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{ padding: '12px', background: 'var(--vscode-sideBar-background)', borderBottom: '1px solid var(--vscode-widget-border)' }}>
                <h3 style={{ margin: '0 0 4px 0' }}>{taskGroup.title}</h3>
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>{taskGroup.description}</div>

                {/* Progress Bar */}
                <div style={{
                    marginTop: '8px',
                    height: '4px',
                    background: 'var(--vscode-progressBar-background)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${percent}%`,
                        height: '100%',
                        background: 'var(--vscode-progressBar-background)', // Needs specific fill color usually, using reliable var
                        backgroundColor: 'var(--vscode-charts-blue)'
                    }} />
                </div>
                <div style={{ fontSize: '10px', marginTop: '2px', textAlign: 'right' }}>{percent}% Complete</div>
            </div>

            {/* Subtasks */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {taskGroup.subtasks.map(subtask => (
                    <SubtaskItem
                        key={subtask.id}
                        subtask={subtask}
                        onToggle={onToggleSubtask}
                    />
                ))}

                {taskGroup.subtasks.length === 0 && (
                    <div style={{ padding: '16px', textAlign: 'center', opacity: 0.6 }}>No subtasks</div>
                )}
            </div>

            <VSCodeDivider />

            {/* Timeline */}
            <div style={{ height: '30%', minHeight: '150px', borderTop: '1px solid var(--vscode-widget-border)' }}>
                <ProgressTimeline updates={taskGroup.progress} />
            </div>
        </div>
    );
};
