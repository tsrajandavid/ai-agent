import React from 'react';
import { TaskGroup, Subtask } from '../types/task-group';
import { VSCodeCheckbox, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import './TaskDocumentView.css';

interface TaskDocumentViewProps {
    taskGroup: TaskGroup;
    onToggleSubtask: (groupId: string, subtaskId: string, completed: boolean) => void;
}

export const TaskDocumentView: React.FC<TaskDocumentViewProps> = ({ taskGroup, onToggleSubtask }) => {

    // Helper to calculate progress
    const total = taskGroup.subtasks.length;
    const completed = taskGroup.subtasks.filter(t => t.status === 'completed' || t.status === 'skipped').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div className="task-document-container">
            <div className="task-document">
                <header className="document-header">
                    <div className="title-row">
                        <h1>{taskGroup.title}</h1>
                        <span className="status-badge" data-status={taskGroup.status}>{taskGroup.status}</span>
                    </div>
                    <div className="meta-row">
                        <span className="progress-text">{progress}% complete</span>
                    </div>
                    {taskGroup.description && (
                        <p className="description">{taskGroup.description}</p>
                    )}
                </header>

                <div className="document-body">
                    <section className="task-section">
                        <h2>Tasks</h2>
                        <div className="task-list">
                            {taskGroup.subtasks.map(task => (
                                <div key={task.id} className={`task-row ${task.status}`}>
                                    <div className="checkbox-wrapper">
                                        <VSCodeCheckbox
                                            checked={task.status === 'completed' || task.status === 'skipped'}
                                            onChange={(e: any) => onToggleSubtask(taskGroup.id, task.id, e.target.checked)}
                                        />
                                    </div>
                                    <div className="task-content">
                                        <span className="task-title">{task.title}</span>
                                        {task.description && <p className="task-desc">{task.description}</p>}
                                        {task.assignedFiles && task.assignedFiles.length > 0 && (
                                            <div className="task-files">
                                                {task.assignedFiles.map(f => (
                                                    <span key={f} className="file-tag">{f}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
