# LLM Integration Guide - OpenRouter

## Overview

This guide covers integrating LLMs into your VS Code extension using OpenRouter.

---

## Why OpenRouter?

| Benefit | Description |
|---------|-------------|
| **Multi-Provider** | Access 100+ models through single API |
| **OpenAI Compatible** | Use `openai` npm package |
| **Free Tier** | Free models for development |
| **Pay-as-you-go** | No subscription required |
| **Model Switching** | Change models without code changes |

---

## Local LLM Support (Ollama) 🦙

You can also run models locally using **Ollama**. This is great for privacy, offline development, and saving costs.

### Setup

1.  **Install Ollama**: Download from [ollama.com](https://ollama.com).
2.  **Pull a Model**:
    ```bash
    ollama pull qwen2.5-coder:3b
    ```
3.  **Start Server**: Ensure Ollama is running (default port `11434`).

### Integration

The extension detects "Local" models by name.
- **Model Name**: `Qwen 2.5 Coder 3B (Local)`
- **Mapping**: The `LLMService` maps this to `qwen2.5-coder:3b` and directs requests to `http://localhost:11434`.

### Code Example

```typescript
// src/llm/llm-service.ts

private getProvider(modelName: string) {
    if (modelName.includes("(Local)")) {
        return new OpenAI({
            baseURL: 'http://localhost:11434/v1', // Ollama's OpenAI-compatible endpoint
            apiKey: 'ollama', // Required but ignored
            dangerouslyAllowBrowser: true 
        });
    }
    // ... OpenRouter fallback
}
```

---

## Setup

### 1. Install Package

```bash
npm install openai
```

### 2. Get API Key

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up / Login
3. Go to Keys → Create Key
4. Copy your API key

---

## Basic Client

```typescript
// src/llm/OpenRouterClient.ts

import OpenAI from 'openai';

export class OpenRouterClient {
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/your-username/ai-agent',
                'X-Title': 'VS Code AI Agent'
            }
        });
        this.model = model;
    }

    // Simple chat completion
    async chat(messages: Message[]): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages
        });

        return response.choices[0]?.message?.content || '';
    }

    // Streaming chat completion
    async *streamChat(messages: Message[]): AsyncGenerator<string> {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: messages,
            stream: true
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }
}

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
```

---

## Streaming Responses

### Why Streaming?

- Better UX (user sees response immediately)
- Can cancel mid-response
- Feels more interactive

### Implementation

```typescript
// src/llm/OpenRouterClient.ts

export class OpenRouterClient {
    private abortController: AbortController | null = null;

    async *streamChat(messages: Message[]): AsyncGenerator<string> {
        // Create new abort controller for this request
        this.abortController = new AbortController();

        try {
            const stream = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                stream: true
            }, {
                signal: this.abortController.signal
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                // Request was cancelled
                return;
            }
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    // Cancel current streaming request
    cancel() {
        this.abortController?.abort();
    }
}
```

### Using in Extension

```typescript
// src/agent/AgentLoop.ts

async function processMessage(userMessage: string) {
    const messages = buildMessages(userMessage);
    
    let fullResponse = '';
    
    // Send to webview that we're starting
    webview.postMessage({ type: 'streamStart' });
    
    try {
        for await (const chunk of llmClient.streamChat(messages)) {
            fullResponse += chunk;
            
            // Send each chunk to webview
            webview.postMessage({ 
                type: 'streamChunk', 
                chunk: chunk 
            });
        }
        
        // Send completion
        webview.postMessage({ 
            type: 'streamEnd',
            fullResponse: fullResponse
        });
        
    } catch (error) {
        webview.postMessage({ 
            type: 'error', 
            message: error.message 
        });
    }
}
```

### Handling in React

```typescript
// webview-ui/src/hooks/useChat.ts

function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentResponse, setCurrentResponse] = useState('');

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            
            switch (message.type) {
                case 'streamStart':
                    setIsStreaming(true);
                    setCurrentResponse('');
                    break;
                    
                case 'streamChunk':
                    setCurrentResponse(prev => prev + message.chunk);
                    break;
                    
                case 'streamEnd':
                    setIsStreaming(false);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: message.fullResponse
                    }]);
                    setCurrentResponse('');
                    break;
                    
                case 'error':
                    setIsStreaming(false);
                    // Handle error
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return { messages, isStreaming, currentResponse };
}
```

---

## Tool Calling (Function Calling)

### Define Tools

```typescript
// src/tools/definitions.ts

export const tools = [
    {
        type: 'function' as const,
        function: {
            name: 'read_file',
            description: 'Read the contents of a file in the workspace',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Relative path to the file from workspace root'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'edit_file',
            description: 'Edit a file by replacing specific text',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'File path'
                    },
                    old_text: {
                        type: 'string',
                        description: 'Exact text to find and replace'
                    },
                    new_text: {
                        type: 'string',
                        description: 'New text to replace with'
                    }
                },
                required: ['path', 'old_text', 'new_text']
            }
        }
    },
    {
        type: 'function' as const,
        function: {
            name: 'run_command',
            description: 'Execute a shell command in the terminal',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'Command to execute'
                    }
                },
                required: ['command']
            }
        }
    }
];
```

### Call with Tools

```typescript
// src/llm/OpenRouterClient.ts

import { tools } from '../tools/definitions';

export class OpenRouterClient {
    
    async chatWithTools(messages: Message[]): Promise<ChatResponse> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages,
            tools: tools,
            tool_choice: 'auto' // Let model decide when to use tools
        });

        const choice = response.choices[0];
        const message = choice.message;

        return {
            content: message.content,
            toolCalls: message.tool_calls?.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments)
            }))
        };
    }
}

interface ChatResponse {
    content: string | null;
    toolCalls?: ToolCall[];
}

interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}
```

### Agent Loop with Tools

```typescript
// src/agent/AgentLoop.ts

export class AgentLoop {
    private llmClient: OpenRouterClient;
    private toolExecutor: ToolExecutor;

    async run(userMessage: string, history: Message[]): Promise<string> {
        const messages: Message[] = [
            { role: 'system', content: this.buildSystemPrompt() },
            ...history,
            { role: 'user', content: userMessage }
        ];

        // Loop until we get a final response (no tool calls)
        while (true) {
            const response = await this.llmClient.chatWithTools(messages);

            // Check if there are tool calls
            if (response.toolCalls && response.toolCalls.length > 0) {
                // Add assistant message with tool calls
                messages.push({
                    role: 'assistant',
                    content: response.content,
                    tool_calls: response.toolCalls
                });

                // Execute each tool
                for (const toolCall of response.toolCalls) {
                    // Notify UI
                    this.webview.postMessage({
                        type: 'toolCall',
                        name: toolCall.name,
                        arguments: toolCall.arguments
                    });

                    // Execute tool
                    const result = await this.toolExecutor.execute(
                        toolCall.name,
                        toolCall.arguments
                    );

                    // Add tool result to messages
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: result
                    });

                    // Notify UI
                    this.webview.postMessage({
                        type: 'toolResult',
                        name: toolCall.name,
                        result: result
                    });
                }
            } else {
                // No tool calls - return final response
                return response.content || '';
            }
        }
    }
}
```

---

## Free Model Fallback

Some free models don't support tool calling. Here's a fallback pattern:

### Structured Prompt Fallback

```typescript
// src/llm/OpenRouterClient.ts

export class OpenRouterClient {
    private supportsTools: boolean;

    constructor(apiKey: string, model: string) {
        // ... setup
        
        // Check if model supports tools
        this.supportsTools = this.checkToolSupport(model);
    }

    private checkToolSupport(model: string): boolean {
        const toolSupportedModels = [
            'anthropic/claude',
            'openai/gpt-4',
            'openai/gpt-3.5-turbo'
        ];
        return toolSupportedModels.some(m => model.includes(m));
    }

    async chatWithTools(messages: Message[]): Promise<ChatResponse> {
        if (this.supportsTools) {
            // Use native tool calling
            return this.nativeToolCall(messages);
        } else {
            // Use structured prompt fallback
            return this.structuredPromptFallback(messages);
        }
    }

    private async structuredPromptFallback(messages: Message[]): Promise<ChatResponse> {
        // Add tool instructions to system prompt
        const toolInstructions = `
You have access to these tools:

${tools.map(t => `
**${t.function.name}**: ${t.function.description}
Parameters: ${JSON.stringify(t.function.parameters.properties, null, 2)}
`).join('\n')}

To use a tool, respond with JSON in this exact format:
{"tool": "tool_name", "arguments": {...}}

To give a final answer without using tools, just respond normally without JSON.
`;

        // Prepend to system message
        const modifiedMessages = [...messages];
        if (modifiedMessages[0]?.role === 'system') {
            modifiedMessages[0].content += '\n\n' + toolInstructions;
        } else {
            modifiedMessages.unshift({
                role: 'system',
                content: toolInstructions
            });
        }

        // Get response
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: modifiedMessages
        });

        const content = response.choices[0]?.message?.content || '';

        // Try to parse tool call from response
        const toolCall = this.parseToolCall(content);

        if (toolCall) {
            return {
                content: null,
                toolCalls: [toolCall]
            };
        } else {
            return {
                content: content,
                toolCalls: undefined
            };
        }
    }

    private parseToolCall(content: string): ToolCall | null {
        try {
            // Look for JSON in response
            const jsonMatch = content.match(/\{[\s\S]*"tool"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.tool && parsed.arguments) {
                    return {
                        id: `call_${Date.now()}`,
                        name: parsed.tool,
                        arguments: parsed.arguments
                    };
                }
            }
        } catch {
            // Not valid JSON, that's okay
        }
        return null;
    }
}
```

---

## Model Selection

### Available Models

| Model | Cost | Quality | Tools |
|-------|------|---------|-------|
| `meta-llama/llama-3.1-8b-instruct:free` | Free | Good | ❌ |
| `google/gemma-2-9b-it:free` | Free | Good | ❌ |
| `mistralai/mistral-7b-instruct:free` | Free | Medium | ❌ |
| `anthropic/claude-3-haiku` | $0.25/1M | Great | ✅ |
| `anthropic/claude-3-sonnet` | $3/1M | Excellent | ✅ |
| `openai/gpt-4-turbo` | $10/1M | Excellent | ✅ |

### Dynamic Model Selection

```typescript
// src/llm/ModelSelector.ts

export class ModelSelector {
    
    selectModel(task: TaskType): string {
        switch (task) {
            case 'simple_qa':
                // Use free model for simple questions
                return 'meta-llama/llama-3.1-8b-instruct:free';
                
            case 'code_edit':
                // Use model with tool support for editing
                return 'anthropic/claude-3-haiku';
                
            case 'code_review':
            case 'architecture':
                // Use best model for complex tasks
                return 'anthropic/claude-3-sonnet';
                
            default:
                return this.getDefaultModel();
        }
    }

    detectTaskType(message: string): TaskType {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('review') || lowerMessage.includes('analyze')) {
            return 'code_review';
        }
        if (lowerMessage.includes('create') || lowerMessage.includes('edit') || 
            lowerMessage.includes('fix') || lowerMessage.includes('add')) {
            return 'code_edit';
        }
        if (lowerMessage.includes('architect') || lowerMessage.includes('design') ||
            lowerMessage.includes('refactor')) {
            return 'architecture';
        }
        
        return 'simple_qa';
    }
}

type TaskType = 'simple_qa' | 'code_edit' | 'code_review' | 'architecture';
```

---

## Cost Tracking

```typescript
// src/llm/CostTracker.ts

export class CostTracker {
    private totalInputTokens = 0;
    private totalOutputTokens = 0;
    private totalCost = 0;

    // Pricing per 1M tokens
    private pricing: Record<string, { input: number; output: number }> = {
        'meta-llama/llama-3.1-8b-instruct:free': { input: 0, output: 0 },
        'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
        'anthropic/claude-3-sonnet': { input: 3, output: 15 },
    };

    trackUsage(model: string, inputTokens: number, outputTokens: number) {
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;

        const price = this.pricing[model] || { input: 0, output: 0 };
        const cost = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
        this.totalCost += cost;

        return {
            requestCost: cost,
            totalCost: this.totalCost,
            totalTokens: this.totalInputTokens + this.totalOutputTokens
        };
    }

    getStats() {
        return {
            inputTokens: this.totalInputTokens,
            outputTokens: this.totalOutputTokens,
            totalTokens: this.totalInputTokens + this.totalOutputTokens,
            totalCost: this.totalCost
        };
    }

    reset() {
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.totalCost = 0;
    }
}
```

### Using Cost Tracker

```typescript
// src/llm/OpenRouterClient.ts

export class OpenRouterClient {
    private costTracker = new CostTracker();

    async chat(messages: Message[]): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages
        });

        // Track usage
        if (response.usage) {
            const stats = this.costTracker.trackUsage(
                this.model,
                response.usage.prompt_tokens,
                response.usage.completion_tokens
            );
            
            // Notify UI about cost
            this.webview?.postMessage({
                type: 'costUpdate',
                ...stats
            });
        }

        return response.choices[0]?.message?.content || '';
    }

    getCostStats() {
        return this.costTracker.getStats();
    }
}
```

---

## Error Handling

```typescript
// src/llm/OpenRouterClient.ts

export class OpenRouterClient {
    
    async chatWithRetry(messages: Message[], maxRetries = 3): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.chat(messages);
            } catch (error) {
                lastError = error as Error;

                // Handle specific errors
                if (error instanceof OpenAI.APIError) {
                    switch (error.status) {
                        case 401:
                            throw new Error('Invalid API key. Please check your settings.');
                            
                        case 429:
                            // Rate limited - wait and retry
                            const waitTime = Math.pow(2, attempt) * 1000;
                            await this.sleep(waitTime);
                            continue;
                            
                        case 500:
                        case 502:
                        case 503:
                            // Server error - retry
                            await this.sleep(1000 * attempt);
                            continue;
                            
                        default:
                            throw new Error(`API error: ${error.message}`);
                    }
                }

                // Network error - retry
                if (error instanceof Error && error.message.includes('network')) {
                    await this.sleep(1000 * attempt);
                    continue;
                }

                throw error;
            }
        }

        throw lastError || new Error('Max retries exceeded');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## Complete Example

```typescript
// src/llm/OpenRouterClient.ts

import OpenAI from 'openai';
import { tools } from '../tools/definitions';
import { CostTracker } from './CostTracker';

export class OpenRouterClient {
    private client: OpenAI;
    private model: string;
    private costTracker: CostTracker;
    private abortController: AbortController | null = null;

    constructor(apiKey: string, model: string) {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/your-username/ai-agent',
                'X-Title': 'VS Code AI Agent'
            }
        });
        this.model = model;
        this.costTracker = new CostTracker();
    }

    setModel(model: string) {
        this.model = model;
    }

    async chat(messages: Message[]): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages
        });

        this.trackUsage(response.usage);
        return response.choices[0]?.message?.content || '';
    }

    async *streamChat(messages: Message[]): AsyncGenerator<string> {
        this.abortController = new AbortController();

        try {
            const stream = await this.client.chat.completions.create({
                model: this.model,
                messages: messages,
                stream: true
            }, {
                signal: this.abortController.signal
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }
        } finally {
            this.abortController = null;
        }
    }

    async chatWithTools(messages: Message[]): Promise<ChatResponse> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: messages,
            tools: tools,
            tool_choice: 'auto'
        });

        this.trackUsage(response.usage);

        const message = response.choices[0].message;
        return {
            content: message.content,
            toolCalls: message.tool_calls?.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments)
            }))
        };
    }

    cancel() {
        this.abortController?.abort();
    }

    getCostStats() {
        return this.costTracker.getStats();
    }

    private trackUsage(usage?: { prompt_tokens: number; completion_tokens: number }) {
        if (usage) {
            this.costTracker.trackUsage(
                this.model,
                usage.prompt_tokens,
                usage.completion_tokens
            );
        }
    }
}

interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
}

interface ChatResponse {
    content: string | null;
    toolCalls?: ToolCall[];
}

interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}
```

---

*This guide covers LLM integration for your VS Code AI agent.*