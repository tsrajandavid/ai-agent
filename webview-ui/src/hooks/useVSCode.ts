import { useState, useEffect } from "react";

// Acquire VS Code API (only call once!)
// @ts-ignore
const vscode = acquireVsCodeApi();

export interface ChatMessage {
    command: string;
    text?: string;
    role: 'user' | 'system' | 'tool';
    tool?: string;
    args?: any;
    result?: string;
}

export function useVSCode() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [streamingContent, setStreamingContent] = useState<string>("");

    const postMessage = (command: string, text: string) => {
        vscode.postMessage({ command, text });
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            // Skip messages handled by App.tsx
            if (['approval-request', 'restore-history', 'update-file-list'].includes(message.command)) {
                return;
            }

            // Handle stream chunks - accumulate into streamingContent
            if (message.command === 'stream-chunk') {
                setStreamingContent(prev => prev + (message.chunk || ''));
                return;
            }

            // Clear chat
            if (message.command === 'clear-chat') {
                setMessages([]);
                setStreamingContent("");
                return;
            }

            // Clear streaming content (for retry)
            if (message.command === 'clear-stream') {
                setStreamingContent("");
                return;
            }

            // Tool call - show that AI is using a tool
            if (message.command === 'tool-call') {
                // Clear any streaming content first
                setStreamingContent("");
                setMessages(prev => [...prev, {
                    command: 'tool-call',
                    role: 'tool',
                    tool: message.tool,
                    args: message.args,
                    text: `🔧 Using **${message.tool}**`
                }]);
                return;
            }

            // Tool result - show the output
            if (message.command === 'tool-result') {
                setMessages(prev => [...prev, {
                    command: 'tool-result',
                    role: 'tool',
                    tool: message.tool,
                    result: message.result,
                    text: message.result
                }]);
                return;
            }

            // On response-complete, clear streaming content and add final message
            if (message.command === 'response-complete') {
                setStreamingContent("");
                setMessages(prev => [...prev, {
                    ...message,
                    role: message.role || 'system'
                }]);
                return;
            }

            // On error, clear streaming content and show error message
            if (message.command === 'error') {
                setStreamingContent("");
                setMessages(prev => [...prev, {
                    ...message,
                    role: message.role || 'system'
                }]);
                return;
            }

            // User message
            if (message.command === 'newMessage') {
                setMessages(prev => [...prev, {
                    ...message,
                    role: message.role || 'user'
                }]);
                return;
            }

            // Handle other messages from extension
            console.log("[useVSCode] Unhandled message:", message);
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return { postMessage, messages, setMessages, streamingContent, setStreamingContent };
}
