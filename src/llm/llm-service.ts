import * as vscode from 'vscode';
import OpenAI from 'openai';

export class LLMService {
    private openai?: OpenAI;
    private model: string = 'google/gemini-2.0-flash-001'; // Default free model

    constructor(private context: vscode.ExtensionContext) {
        this.initialize();
    }

    private async initialize() {
        const apiKey = await this.context.secrets.get('ai-agent.apiKey');
        if (apiKey) {
            this.setupClient(apiKey);
        }
    }

    public async setApiKey(apiKey: string) {
        await this.context.secrets.store('ai-agent.apiKey', apiKey);
        this.setupClient(apiKey);
    }

    private setupClient(apiKey: string) {
        this.openai = new OpenAI({
            apiKey: apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/tsrajandavid/ai-agent',
                'X-Title': 'VS Code AI Agent',
            },
        });
    }

    public async validateApiKey(): Promise<boolean> {
        if (!this.openai) return false;
        try {
            await this.openai.models.list();
            return true;
        } catch (error) {
            console.error('API Key validation failed:', error);
            return false;
        }
    }

    public async sendRequest(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], onChunk?: (chunk: string) => void): Promise<string> {
        if (!this.openai) {
            throw new Error('API Key not configured. Please set your OpenRouter API Key.');
        }

        try {
            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: messages,
                stream: true,
            });

            let fullResponse = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponse += content;
                if (onChunk) {
                    onChunk(content);
                }
            }

            return fullResponse;
        } catch (error) {
            console.error('LLM Request failed:', error);
            throw error;
        }
    }

    public setModel(modelId: string) {
        this.model = modelId;
    }
}
