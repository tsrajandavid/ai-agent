import * as path from 'path';
import * as fs from 'fs';

export interface ChatMessage {
    role: 'user' | 'system' | 'tool';
    text: string;
    command?: string;
    tool?: string;
    result?: string;
    timestamp?: number;
}

export interface Conversation {
    id: string;
    title: string;
    timestamp: number;
    messages: ChatMessage[];
}

export class ChatStorage {
    private dataFile: string;
    private data: Conversation[] = [];
    private loaded: boolean = false;

    constructor(workspaceRoot: string) {
        const dataDir = path.join(workspaceRoot, '.agent', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.dataFile = path.join(dataDir, 'conversations.json');
    }

    private async ensureLoaded() {
        if (this.loaded) return;

        try {
            if (fs.existsSync(this.dataFile)) {
                const content = await fs.promises.readFile(this.dataFile, 'utf-8');
                this.data = JSON.parse(content);
            } else {
                this.data = [];
            }
        } catch (error) {
            console.error('[ChatStorage] Failed to load data:', error);
            this.data = [];
        }
        this.loaded = true;
    }

    private async flush() {
        try {
            await fs.promises.writeFile(this.dataFile, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('[ChatStorage] Failed to save data:', error);
        }
    }

    async saveAll(conversations: Conversation[]): Promise<void> {
        this.data = conversations;
        this.loaded = true;
        await this.flush();
    }

    async getAll(): Promise<Conversation[]> {
        await this.ensureLoaded();
        return this.data.sort((a, b) => b.timestamp - a.timestamp);
    }
}
