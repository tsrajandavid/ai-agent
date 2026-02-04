import { useState, useEffect } from "react";

// Acquire VS Code API (only call once!)
// @ts-ignore
const vscode = acquireVsCodeApi();

export function useVSCode() {
    const [messages, setMessages] = useState<any[]>([]);

    const postMessage = (command: string, text: string) => {
        vscode.postMessage({ command, text });
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            // Handle messages from extension if needed
            console.log("Received message from extension:", message);
            setMessages(prev => [...prev, message]);
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return { postMessage, messages };
}
