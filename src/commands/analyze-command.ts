import { SlashCommand } from './command-interface';
import * as vscode from 'vscode';
import { ProjectIndexer } from '../services/project-indexer';
import { LLMService } from '../llm/llm-service';
import { ContextAnalyzer } from '../agent/context-analyzer';

export class AnalyzeCommand implements SlashCommand {
    name = '/analyze';
    description = 'Analyze project structure and architecture';

    constructor(
        private projectIndexer: ProjectIndexer | undefined,
        private llmService: LLMService
    ) { }

    async execute(_args: string, webview: vscode.Webview): Promise<void> {
        if (!this.projectIndexer) {
            webview.postMessage({ command: 'response-complete', text: '❌ Project Indexer not initialized', role: 'system' });
            return;
        }

        webview.postMessage({ command: 'newMessage', text: '🔍 Analyzing project structure and architecture...', role: 'assistant' });

        try {
            const analyzer = new ContextAnalyzer(this.projectIndexer, this.llmService);
            const analysis = await analyzer.analyze();

            webview.postMessage({
                command: 'response-complete',
                text: analysis,
                role: 'assistant'
            });
        } catch (err: any) {
            webview.postMessage({ command: 'response-complete', text: `❌ Analysis failed: ${err.message}`, role: 'system' });
        }
    }
}
