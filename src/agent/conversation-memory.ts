/**
 * Tracks conversation context across messages for richer system prompts.
 * Maintains files discussed, decisions made, user preferences, and task progress.
 */
export interface MemoryState {
    filesDiscussed: Set<string>;
    filesModified: Set<string>;
    decisions: string[];
    userPreferences: Record<string, string>;
    taskProgress: {
        completed: string[];
        pending: string[];
    };
}

export class ConversationMemory {
    private state: MemoryState;

    constructor() {
        this.state = this.createEmpty();
    }

    private createEmpty(): MemoryState {
        return {
            filesDiscussed: new Set(),
            filesModified: new Set(),
            decisions: [],
            userPreferences: {},
            taskProgress: { completed: [], pending: [] }
        };
    }

    /**
     * Extract memory from conversation messages.
     * Scans user/assistant messages for file paths, decisions, and task markers.
     */
    public extractFromMessages(messages: Array<{ role: string; content: string }>): void {
        for (const msg of messages) {
            this.extractFilePaths(msg.content, msg.role);
            if (msg.role === 'assistant') {
                this.extractDecisions(msg.content);
                this.extractTaskProgress(msg.content);
            }
        }
    }

    private extractFilePaths(content: string, role: string): void {
        // Match common file path patterns (src/..., ./..., *.ts, *.tsx, etc.)
        const filePatterns = [
            /(?:src|lib|components|pages|app|hooks|utils|services|models|routes)\/[\w\-./]+\.\w+/g,
            /\.\/[\w\-./]+\.\w+/g,
            /[\w\-]+\.(?:ts|tsx|js|jsx|css|json|md|html)/g
        ];

        for (const pattern of filePatterns) {
            const matches = content.match(pattern);
            if (matches) {
                for (const match of matches) {
                    this.state.filesDiscussed.add(match);
                }
            }
        }

        // Detect file modifications from tool usage patterns
        if (role === 'assistant') {
            const writeMatches = content.match(/(?:write_file|edit_file|created|modified|updated).*?([\w\-./]+\.\w+)/gi);
            if (writeMatches) {
                for (const match of writeMatches) {
                    const fileMatch = match.match(/([\w\-./]+\.\w+)/);
                    if (fileMatch) {
                        this.state.filesModified.add(fileMatch[1]);
                    }
                }
            }
        }
    }

    private extractDecisions(content: string): void {
        // Look for decision patterns in assistant responses
        const decisionPatterns = [
            /I'll (?:use|go with|choose|implement) (.+?)(?:\.|$)/gim,
            /(?:decided|choosing|using) (.+?) (?:because|since|for)/gim
        ];

        for (const pattern of decisionPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const decision = match[1].trim();
                if (decision.length > 5 && decision.length < 100 && !this.state.decisions.includes(decision)) {
                    this.state.decisions.push(decision);
                }
            }
        }

        // Cap decisions to prevent unbounded growth
        if (this.state.decisions.length > 10) {
            this.state.decisions = this.state.decisions.slice(-10);
        }
    }

    private extractTaskProgress(content: string): void {
        // Look for completed task markers
        const completedPatterns = [
            /(?:Created|Fixed|Added|Updated|Implemented|Done|Completed)[:\s]+(.+?)(?:\n|$)/gim
        ];

        for (const pattern of completedPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const task = match[1].trim();
                if (task.length > 3 && task.length < 80) {
                    if (!this.state.taskProgress.completed.includes(task)) {
                        this.state.taskProgress.completed.push(task);
                    }
                }
            }
        }

        // Cap completed tasks
        if (this.state.taskProgress.completed.length > 15) {
            this.state.taskProgress.completed = this.state.taskProgress.completed.slice(-15);
        }
    }

    /**
     * Record a user preference (e.g., "use tabs", "prefer functional components")
     */
    public setPreference(key: string, value: string): void {
        this.state.userPreferences[key] = value;
    }

    /**
     * Add a pending task
     */
    public addPendingTask(task: string): void {
        if (!this.state.taskProgress.pending.includes(task)) {
            this.state.taskProgress.pending.push(task);
        }
    }

    /**
     * Mark a pending task as completed
     */
    public completeTask(task: string): void {
        this.state.taskProgress.pending = this.state.taskProgress.pending.filter(t => t !== task);
        if (!this.state.taskProgress.completed.includes(task)) {
            this.state.taskProgress.completed.push(task);
        }
    }

    /**
     * Format memory state for inclusion in system prompt
     */
    public formatForPrompt(): string {
        const filesDiscussed = [...this.state.filesDiscussed];
        const filesModified = [...this.state.filesModified];

        // Only include if there's meaningful content
        if (filesDiscussed.length === 0 && filesModified.length === 0 &&
            this.state.decisions.length === 0 && this.state.taskProgress.completed.length === 0) {
            return '';
        }

        const sections: string[] = [];

        sections.push(`
══════════════════════════════════════════════════════════════════════════════
                              CONVERSATION CONTEXT
══════════════════════════════════════════════════════════════════════════════`);

        if (filesDiscussed.length > 0) {
            sections.push(`\nFiles Discussed:\n${filesDiscussed.slice(-10).map(f => `  • ${f}`).join('\n')}`);
        }

        if (filesModified.length > 0) {
            sections.push(`\nFiles Modified This Session:\n${filesModified.slice(-10).map(f => `  • ${f}`).join('\n')}`);
        }

        if (this.state.decisions.length > 0) {
            sections.push(`\nDecisions Made:\n${this.state.decisions.slice(-5).map(d => `  • ${d}`).join('\n')}`);
        }

        const prefs = Object.entries(this.state.userPreferences);
        if (prefs.length > 0) {
            sections.push(`\nUser Preferences:\n${prefs.map(([k, v]) => `  • ${k}: ${v}`).join('\n')}`);
        }

        if (this.state.taskProgress.completed.length > 0 || this.state.taskProgress.pending.length > 0) {
            let progress = '\nTask Progress:';
            for (const task of this.state.taskProgress.completed.slice(-5)) {
                progress += `\n  ✅ ${task}`;
            }
            for (const task of this.state.taskProgress.pending) {
                progress += `\n  🔄 ${task}`;
            }
            sections.push(progress);
        }

        return sections.join('\n');
    }

    /**
     * Reset conversation memory (e.g., when starting a new conversation)
     */
    public reset(): void {
        this.state = this.createEmpty();
    }

    /**
     * Get raw state (for serialization)
     */
    public getState(): { filesDiscussed: string[]; filesModified: string[]; decisions: string[]; userPreferences: Record<string, string>; taskProgress: { completed: string[]; pending: string[] } } {
        return {
            filesDiscussed: [...this.state.filesDiscussed],
            filesModified: [...this.state.filesModified],
            decisions: this.state.decisions,
            userPreferences: this.state.userPreferences,
            taskProgress: this.state.taskProgress
        };
    }
}
