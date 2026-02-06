// Shared types for AI Agent webview UI

export interface Mode {
  id: string;
  label: string;
  desc: string;
}

export interface SlashCommand {
  cmd: string;
  icon: string;
  label: string;
  desc: string;
}

export interface ChatMessage {
  role: 'user' | 'system' | 'tool';
  text: string;
  command?: string;
  tool?: string;
  result?: string;
  timestamp?: number;
}

export interface ApprovalData {
  tool: string;
  filePath: string;
  oldContent?: string;
  newContent?: string;
  oldString?: string;
  newString?: string;
}

export interface Conversation {
  id: string;
  title: string;
  timestamp: number;
}
