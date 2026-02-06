import React from 'react';
import type { Conversation } from '../types';
import './ChatHistory.css';

interface ChatHistoryProps {
    conversations: Conversation[];
    activeId: string;
    onSelect: (id: string) => void;
    onNewChat: () => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onDelete
}) => {
    // Group by date (Today, Yesterday, Previous 7 Days, Older)
    const grouped = conversations.reduce((acc, chat) => {
        const date = new Date(chat.timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        let group = 'Older';
        if (diffDays === 0) group = 'Today';
        else if (diffDays === 1) group = 'Yesterday';
        else if (diffDays <= 7) group = 'Previous 7 Days';

        if (!acc[group]) acc[group] = [];
        acc[group].push(chat);
        return acc;
    }, {} as Record<string, Conversation[]>);

    const groups = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

    return (
        <div className="chat-history">
            <div className="history-header">
                <button className="new-chat-btn" onClick={onNewChat}>
                    <span className="plus-icon">+</span> New Chat
                </button>
            </div>

            <div className="history-list">
                {groups.map(group => {
                    const chats = grouped[group];
                    if (!chats || chats.length === 0) return null;

                    return (
                        <div key={group} className="history-group">
                            <div className="group-label">{group}</div>
                            {chats.map(chat => (
                                <div
                                    key={chat.id}
                                    className={`history-item ${chat.id === activeId ? 'active' : ''}`}
                                    onClick={() => onSelect(chat.id)}
                                >
                                    <span className="history-title">{chat.title || 'New Chat'}</span>
                                    <button
                                        className="delete-chat-btn"
                                        onClick={(e) => onDelete(chat.id, e)}
                                        title="Delete chat"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
