import React, { useState, useCallback } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import { renderMarkdown } from './MarkdownRenderer';

// Thinking Indicator Component
export const ThinkingIndicator = () => (
  <div className="message system">
    <div className="message-wrapper">
      <div className="message-avatar system-avatar">AI</div>
      <div className="message-body">
        <div className="thinking-indicator">
          <div className="thinking-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="thinking-text">Thinking...</span>
        </div>
      </div>
    </div>
  </div>
);

// Main Message Component
interface MessageProps {
  role: 'user' | 'system' | 'tool';
  text: string;
  command?: string;
  tool?: string;
  result?: string;
}

export const Message = React.memo(({ role, text, command }: MessageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text]);

  // Hide tool messages entirely — they are filtered in App.tsx via HIDDEN_COMMANDS
  // but guard here as well for safety
  if (role === 'tool' || command === 'tool-call' || command === 'tool-result') {
    return null;
  }

  const isUser = role === 'user';

  // Strip <think> blocks from AI responses
  const cleanText = isUser ? text : text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Skip empty AI messages (e.g. tool-only turns with no visible content)
  if (!isUser && !cleanText) return null;

  return (
    <div className={`message ${role}`}>
      <div className="message-wrapper">
        <div className={`message-avatar ${isUser ? 'user-avatar' : 'system-avatar'}`}>
          {isUser ? 'U' : 'AI'}
        </div>
        <div className="message-body">
          <div className="message-header">
            <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
          </div>
          <div className="message-content">
            {renderMarkdown(cleanText)}
          </div>
        </div>
      </div>
      {!isUser && (
        <button
          className={`message-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          title="Copy message"
        >
          {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
        </button>
      )}
    </div>
  );
});
