import React from 'react';
import type { ProgressUpdate } from '../../types/task-group';

interface ProgressTimelineProps {
    updates: ProgressUpdate[];
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ updates }) => {
    // Show newest first
    const sortedUpdates = [...updates].sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '8px',
            maxHeight: '200px',
            overflowY: 'auto'
        }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', textTransform: 'uppercase', opacity: 0.8 }}>Activity Log</h4>

            {sortedUpdates.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
                    No activity yet.
                </div>
            )}

            {sortedUpdates.map((update, index) => {
                const date = new Date(update.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let icon = 'ℹ️';
                let color = 'var(--vscode-textPreformat-foreground)';

                if (update.type === 'success') { icon = '✅'; color = 'var(--vscode-testing-iconPassed)'; }
                if (update.type === 'error') { icon = '❌'; color = 'var(--vscode-testing-iconFailed)'; }
                if (update.type === 'warning') { icon = '⚠️'; color = 'var(--vscode-problemsWarningIcon-foreground)'; }

                return (
                    <div key={index} style={{
                        display: 'flex',
                        gap: '8px',
                        fontSize: '12px',
                        alignItems: 'flex-start'
                    }}>
                        <span style={{ fontSize: '10px', color: 'var(--vscode-descriptionForeground)', minWidth: '45px' }}>
                            {timeStr}
                        </span>
                        <span style={{ flexShrink: 0 }}>{icon}</span>
                        <span style={{ color }}>{update.message}</span>
                    </div>
                );
            })}
        </div>
    );
};
