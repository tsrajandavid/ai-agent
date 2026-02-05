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

    public resetContext() {
        // This method is intended to reset any internal state related to conversation context.
        // For now, the LLMService itself doesn't maintain conversation history,
        // so this method can be empty or log a message.
        console.log('[LLM Service] resetContext called. No internal context to reset.');
    }

    public async sendRequest(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], onChunk?: (chunk: string) => void): Promise<string> {
        console.log('[LLM Service] sendRequest called, model:', this.model);

        // Handle Local Ollama Case
        if (this.model === "qwen2.5-coder:3b" || this.model.includes("(Local)")) {
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

    setModel(modelId: string) {
        // Map user-friendly names to API IDs
        const mapping: Record<string, string> = {
            "Gemini 2.0 Flash (Fast)": "google/gemini-2.0-flash-001",
            "Gemini 3 Pro (High)": "google/gemini-pro-1.5",
            "Claude 3.5 Sonnet (Coding)": "anthropic/claude-3.5-sonnet",
            "DeepSeek R1 (Reasoning)": "deepseek/deepseek-r1",
            "Qwen 2.5 Coder 3B (Local)": "qwen2.5-coder:3b" // Local Ollama
        };

        this.model = mapping[modelId] || modelId;
        console.log(`[LLMService] Set model to: ${this.model}`);
    }
}
