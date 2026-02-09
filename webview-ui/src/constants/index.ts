import type { Mode, SlashCommand } from '../types';

// Mode definitions - ACT is first (default)
export const MODES: Mode[] = [
  { id: "ACT", label: "Action", desc: "Direct execution. Best for file operations." },
  { id: "PLAN", label: "Planning", desc: "Plan before executing. Best for complex tasks." },
  { id: "ASK", label: "Ask", desc: "Answer questions only. No file modifications." }
];

export const DEFAULT_MODEL = "Qwen 2.5 Coder 3B (Local)";

export const MODELS = [
  { id: "qwen2.5-coder:3b", label: "Qwen 2.5 Coder 3B (Local)", desc: "Local Ollama model" },
  { id: "google/gemini-1.5-flash-8b", label: "Gemini 1.5 Flash (Google)", desc: "Google DeepMind" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", desc: "Anthropic via OpenRouter" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1 (OpenRouter)", desc: "DeepSeek via OpenRouter" },
  { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 (Groq)", desc: "Groq (Fast)" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", desc: "Groq (Fast)" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7b (Groq)", desc: "Groq (Fast)" },
  { id: "google/gemini-2.0-flash-lite-preview-02-05:free", label: "Gemini 2.0 Flash Lite (Free)", desc: "OpenRouter Free Tier" },
  { id: "nousresearch/hermes-3-llama-3.1-405b:free", label: "Hermes 3 405B (Free)", desc: "OpenRouter Free Tier" },
  { id: "tngtech/deepseek-r1t2-chimera:free", label: "DeepSeek R1T2 Chimera (Free)", desc: "OpenRouter Free Tier" }
];

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
  { cmd: '/plan', icon: '📅', label: 'Plan', desc: 'Create a plan with subtasks' },
  { cmd: '/help', icon: '❓', label: 'Help', desc: 'Show all commands' },
];
