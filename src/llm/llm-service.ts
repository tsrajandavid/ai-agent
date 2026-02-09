import OpenAI from 'openai';
import * as vscode from 'vscode';

export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export class LLMService {
    private openai: OpenAI | null = null;
    private model: string = 'openai/gpt-4o'; // Default

    constructor(private context: vscode.ExtensionContext) {
        this.initialize();
    }

    private initialize() {
        const apiKey = vscode.workspace.getConfiguration('ai-agent').get<string>('openrouterApiKey') ||
            process.env.OPENROUTER_API_KEY;

        if (apiKey) {
            this.openai = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: apiKey,
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/tsrajandavid/ai-agent",
                    "X-Title": "AI Agent Extension",
                }
            });
        }
    }

    public setModel(model: string) {
        this.model = model;
        console.log('[LLM Service] Model set to:', model);
    }

    public getModel(): string {
        return this.model;
    }

    public async setApiKey(apiKey: string) {
        await vscode.workspace.getConfiguration('ai-agent').update('openrouterApiKey', apiKey, vscode.ConfigurationTarget.Global);
        this.initialize();
    }

    public async setGoogleApiKey(apiKey: string) {
        await vscode.workspace.getConfiguration('ai-agent').update('googleApiKey', apiKey, vscode.ConfigurationTarget.Global);
        this.initialize();
    }

    public async setGroqApiKey(apiKey: string) {
        await vscode.workspace.getConfiguration('ai-agent').update('groqApiKey', apiKey, vscode.ConfigurationTarget.Global);
        this.initialize();
    }

    public resetContext() {
        // In this implementation, context is managed per request
        console.log('[LLM Service] Context reset requested');
    }

    public abort(): boolean {
        // Placeholder for abort logic if needed
        console.log('[LLM Service] Abort requested');
        return true;
    }

    public async sendRequest(messages: ConversationMessage[], onChunk?: (chunk: string) => void): Promise<string> {
        const controller = new AbortController();
        const signal = controller.signal;

        try {
            // 1. Google Gemini Direct Case (if using specialized models)
            if (this.model.includes('google/gemini')) {
                const googleKey = vscode.workspace.getConfiguration('ai-agent').get<string>('googleApiKey') ||
                    process.env.GOOGLE_API_KEY;

                if (!googleKey) {
                    console.warn('[LLM Service] Google API Key missing, falling back to OpenRouter...');
                } else {
                    const googleAI = new OpenAI({
                        apiKey: googleKey,
                        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
                    });

                    const modelName = this.model.split('/').pop() || 'gemini-1.5-flash';
                    console.log('[LLM Service] Using Google Gemini Direct:', modelName);

                    try {
                        const stream = await googleAI.chat.completions.create({
                            model: modelName,
                            messages: messages,
                            stream: true,
                        }, { signal });

                        let fullResponse = '';
                        for await (const chunk of stream) {
                            if (signal.aborted) throw new Error('Request aborted');
                            const content = chunk.choices[0]?.delta?.content || '';
                            fullResponse += content;
                            if (onChunk) onChunk(content);
                        }
                        return fullResponse;
                    } catch (e: any) {
                        console.error('[LLM Service] Google Error:', e);
                        // Fallback to "gemini-pro" if Flash fails (legacy model is very stable)
                        if (e.status === 404) {
                            console.log('[LLM Service] Fallback to gemini-pro...');
                            const fallbackStream = await googleAI.chat.completions.create({
                                model: 'gemini-pro',
                                messages: messages,
                                stream: true,
                            }, { signal });

                            let fullResponse = '';
                            for await (const chunk of fallbackStream) {
                                const content = chunk.choices[0]?.delta?.content || '';
                                fullResponse += content;
                                if (onChunk) onChunk(content);
                            }
                            return fullResponse;
                        }
                        throw e;
                    }
                }
            }

            // 2. Groq Direct
            if (this.model === 'llama-3.3-70b-versatile' || this.model === 'mixtral-8x7b-32768' || this.model === 'deepseek-r1-distill-llama-70b') {
                const groqKey = vscode.workspace.getConfiguration('ai-agent').get<string>('groqApiKey') ||
                    process.env.GROQ_API_KEY;

                if (!groqKey) {
                    throw new Error('Groq API Key not configured. Use the "Set Groq API Key" command.');
                }

                const groqInfo = new OpenAI({
                    apiKey: groqKey,
                    baseURL: 'https://api.groq.com/openai/v1',
                });

                console.log('[LLM Service] Using Groq:', this.model);

                const stream = await groqInfo.chat.completions.create({
                    model: this.model,
                    messages: messages,
                    stream: true,
                }, { signal });

                let fullResponse = '';
                for await (const chunk of stream) {
                    if (signal.aborted) throw new Error('Request aborted');
                    const content = chunk.choices[0]?.delta?.content || '';
                    fullResponse += content;
                    if (onChunk) onChunk(content);
                }
                return fullResponse;
            }

            // 3. Local Ollama Case
            if (this.model === "qwen2.5-coder:3b" || this.model.includes("(Local)")) {
                console.log('[LLM Service] Using local Ollama...');
                const ollama = new OpenAI({
                    baseURL: 'http://localhost:11434/v1',
                    apiKey: 'ollama',
                });

                console.log('[LLM Service] Creating Ollama stream...');
                const stream = await ollama.chat.completions.create({
                    model: 'qwen2.5-coder:3b',
                    messages: messages,
                    stream: true,
                }, { signal });

                let fullResponse = '';
                for await (const chunk of stream) {
                    if (signal.aborted) {
                        throw new Error('Request aborted');
                    }
                    const content = chunk.choices[0]?.delta?.content || '';
                    fullResponse += content;
                    if (onChunk) onChunk(content);
                }
                console.log('[LLM Service] Ollama response complete, length:', fullResponse.length);
                return fullResponse;
            }

            // 4. Standard OpenRouter Case
            if (!this.openai) {
                console.error('[LLM Service] OpenAI client not initialized - API Key missing');
                throw new Error('OpenRouter API Key not configured.');
            }

            console.log('[LLM Service] Creating OpenRouter stream for model:', this.model);

            // Adaptive token limit: Free models often have strict rate/budget limits (402 errors).
            // Cap them at 1024 to fit within "affordability". Paid models get 4096.
            // EXCEPT for reasoning models (DeepSeek R1, etc.) which need more space for thinking.
            const isReasoningModel = this.model.toLowerCase().includes('deepseek') || this.model.toLowerCase().includes('r1');
            const maxTokens = (this.model.includes(':free') && !isReasoningModel) ? 1024 : 4096;

            const stream = await this.openai.chat.completions.create({
                model: this.model,
                messages: messages,
                max_tokens: maxTokens,
                stream: true,
            }, { signal });

            let fullResponse = '';

            for await (const chunk of stream) {
                if (signal.aborted) {
                    throw new Error('Request aborted');
                }
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponse += content;
                if (onChunk) {
                    onChunk(content);
                }
            }

            console.log('[LLM Service] OpenRouter response complete, length:', fullResponse.length);
            return fullResponse;
        } catch (error: any) {
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                console.log('[LLM Service] Request aborted.');
                return '';
            }
            console.error('[LLM Service] API Error:', error);
            throw error;
        }
    }
}
