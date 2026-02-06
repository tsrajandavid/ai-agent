import type { Mode, SlashCommand } from '../types';

// Mode definitions - ACT is first (default)
export const MODES: Mode[] = [
  { id: "ACT", label: "Action", desc: "Direct execution. Best for file operations." },
  { id: "PLAN", label: "Planning", desc: "Plan before executing. Best for complex tasks." },
  { id: "ASK", label: "Ask", desc: "Answer questions only. No file modifications." }
];

export const DEFAULT_MODEL = "Qwen 2.5 Coder 3B (Local)";

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: '/commit', icon: '📝', label: 'Commit', desc: 'Commit changes with AI message' },
  { cmd: '/diff', icon: '📊', label: 'Diff', desc: 'Show uncommitted changes' },
  { cmd: '/status', icon: '📋', label: 'Status', desc: 'Show git status' },
  { cmd: '/log', icon: '📜', label: 'Log', desc: 'Show recent commits' },
  { cmd: '/test', icon: '🧪', label: 'Test', desc: 'Run tests' },
  { cmd: '/build', icon: '🔨', label: 'Build', desc: 'Build project' },
  { cmd: '/run', icon: '▶️', label: 'Run', desc: 'Run a command' },
  { cmd: '/add', icon: '➕', label: 'Add', desc: 'Add file to context' },
  { cmd: '/context', icon: '📂', label: 'Context', desc: 'Show context files' },
  { cmd: '/clear', icon: '🗑️', label: 'Clear', desc: 'Clear chat history' },
  { cmd: '/help', icon: '❓', label: 'Help', desc: 'Show all commands' },
];
