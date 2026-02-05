import * as vscode from 'vscode';
import OpenAI from 'openai';

export class LLMService {
    private openai?: OpenAI;
    private model: string = 'Qwen 2.5 Coder 3B (Local)'; // Default: Local Qwen model

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
        console.log('[LLM Service] sendRequest called, model:', this.model);

        // Handle Local Ollama Case
        if (this.model === "Qwen 2.5 Coder 3B (Local)") {
            console.log('[LLM Service] Using local Ollama...');
            const ollama = new OpenAI({
                baseURL: 'http://localhost:11434/v1',
                apiKey: 'ollama', // Ollama doesn't require an API key, but client might
            });
            try {
                console.log('[LLM Service] Creating Ollama stream...');
                const stream = await ollama.chat.completions.create({
                    model: 'qwen2.5-coder:3b', // Map UI name to Ollama model name
                    messages: messages,
                    stream: true,
                });

                let fullResponse = '';
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    fullResponse += content;
                    if (onChunk) onChunk(content);
                }
                console.log('[LLM Service] Ollama response complete, length:', fullResponse.length);
                return fullResponse;
            } catch (error) {
                console.error("[LLM Service] Local LLM Error:", error);
                throw new Error("Failed to connect to Local LLM at http://localhost:11434. Is Ollama running?");
            }
        }

        // Standard OpenRouter Case
        if (!this.openai) {
            console.error('[LLM Service] OpenAI client not initialized - API Key missing');
            throw new Error('API Key not configured. Please set your OpenRouter API Key.');
        }

        try {
            console.log('[LLM Service] Creating OpenRouter stream for model:', this.model);
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

            console.log('[LLM Service] OpenRouter response complete, length:', fullResponse.length);
            return fullResponse;
        } catch (error) {
            console.error('[LLM Service] LLM Request failed:', error);
            throw error;
        }
    }

    public setModel(modelName: string) {
        const modelMap: { [key: string]: string } = {
            "Gemini 3 Pro (High)": "google/gemini-2.0-pro-exp-02-05",
            "Gemini 3 Pro (Low)": "google/gemini-2.0-pro-exp-02-05",
            "Gemini 3 Flash": "google/gemini-2.0-flash-001",
            "Claude Sonnet 4.5": "anthropic/claude-3.5-sonnet",
            "Claude Sonnet 4.5 (Thinking)": "anthropic/claude-3.7-sonnet-thinking",
            "Claude Opus 4.5 (Thinking)": "anthropic/claude-3-opus",
            "GPT-OSS 120B (Medium)": "openai/gpt-4o",
            "Qwen 2.5 Coder 3B (Local)": "Qwen 2.5 Coder 3B (Local)"
        };

        this.model = modelMap[modelName] || modelName;
        console.log(`Model set to: ${this.model} (from ${modelName})`);
    }
}
