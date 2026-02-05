import { useState, useEffect } from "react";

// Acquire VS Code API (only call once!)
// @ts-ignore
const vscode = acquireVsCodeApi();

export function useVSCode() {
    const [messages, setMessages] = useState<any[]>([]);
    const [streamingContent, setStreamingContent] = useState<string>("");

    const postMessage = (command: string, text: string) => {
        vscode.postMessage({ command, text });
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            // Handle stream chunks - accumulate into streamingContent
            if (message.command === 'stream-chunk') {
                setStreamingContent(prev => prev + (message.chunk || ''));
                return;
            }

            // On response-complete, clear streaming content and add final message
            if (message.command === 'response-complete') {
                setStreamingContent("");
                setMessages(prev => [...prev, message]);
                return;
            }

            // On error, clear streaming content and show error message
            if (message.command === 'error') {
                setStreamingContent("");
                setMessages(prev => [...prev, { ...message, role: message.role || 'system' }]);
                return;
            }

            // Handle other messages from extension
            console.log("Received message from extension:", message);
            setMessages(prev => [...prev, message]);
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return { postMessage, messages, streamingContent };
}
