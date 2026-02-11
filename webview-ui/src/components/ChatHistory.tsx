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

// Titles to exclude from history
const EXCLUDED_TITLES = new Set(['new chat', 'continue', '']);

function isValidHistoryEntry(chat: Conversation): boolean {
    const title = (chat.title || '').trim().toLowerCase();
    if (EXCLUDED_TITLES.has(title)) return false;
    if (title.startsWith('/')) return false; // slash commands
    if (title.length < 3) return false;
    return true;
}

function deduplicateByTitle(chats: Conversation[]): Conversation[] {
    const seen = new Set<string>();
    return chats.filter(chat => {
        const key = chat.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
    conversations,
    activeId,
    onSelect,
    onNewChat,
    onDelete
}) => {
    // Filter and deduplicate
    const filtered = deduplicateByTitle(
        conversations.filter(isValidHistoryEntry)
    );

    // Group by date
    const grouped = filtered.reduce((acc, chat) => {
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
                <span className="history-heading">History</span>
                <button className="new-chat-btn" onClick={onNewChat} title="New chat">
                    +
                </button>
            </div>

            <div className="history-list">
                {filtered.length === 0 ? (
                    <div className="history-empty">No conversations yet</div>
                ) : (
                    groups.map(group => {
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
                                        <span className="history-title">{chat.title}</span>
                                        <button
                                            className="delete-chat-btn"
                                            onClick={(e) => onDelete(chat.id, e)}
                                            title="Delete"
                                        >
                                            &#128465;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
