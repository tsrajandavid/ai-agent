import React from 'react';
import type { Subtask } from '../../types/task-group';
import { VSCodeCheckbox, VSCodeTag } from '@vscode/webview-ui-toolkit/react';

interface SubtaskItemProps {
    subtask: Subtask;
    onToggle?: (id: string, completed: boolean) => void;
}

export const SubtaskItem: React.FC<SubtaskItemProps> = ({ subtask, onToggle }) => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '8px',
            borderBottom: '1px solid var(--vscode-widget-border)',
            opacity: subtask.status === 'skipped' ? 0.6 : 1
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <VSCodeCheckbox
                    checked={subtask.status === 'completed'}
                    disabled={subtask.status === 'skipped'}
                    onChange={(e: any) => onToggle && onToggle(subtask.id, e.target.checked)}
                >
                    <span style={{
                        textDecoration: subtask.status === 'completed' ? 'line-through' : 'none',
                        color: subtask.status === 'completed' ? 'var(--vscode-descriptionForeground)' : 'var(--vscode-foreground)'
                    }}>
                        {subtask.title}
                    </span>
                </VSCodeCheckbox>

                {subtask.status === 'not-started' && (
                    <VSCodeTag style={{ fontSize: '10px', height: '16px', marginLeft: 'auto' }}>Todo</VSCodeTag>
                )}
            </div>

            {subtask.description && (
                <div style={{
                    fontSize: '11px',
                    color: 'var(--vscode-descriptionForeground)',
                    paddingLeft: '28px'
                }}>
                    {subtask.description}
                </div>
            )}
        </div>
    );
};
