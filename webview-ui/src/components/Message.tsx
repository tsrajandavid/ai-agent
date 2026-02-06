import React, { useState, useCallback } from 'react';
import { ChevronIcon, CopyIcon, CheckIcon } from './Icons';
import { renderMarkdown } from './MarkdownRenderer';

// Thinking Indicator Component
export const ThinkingIndicator = () => (
  <div className="message system">
    <div className="message-wrapper">
      <div className="message-avatar">AI</div>
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

// Tool Message Component
interface ToolMessageProps {
  tool: string;
  result?: string;
  isCall?: boolean;
}

export const ToolMessage = React.memo(({ tool, result, isCall }: ToolMessageProps) => {
  const [expanded, setExpanded] = useState(!isCall);

  return (
    <div className="message tool">
      <div className="message-wrapper">
        <div className="message-avatar tool-avatar">🔧</div>
        <div className="message-body">
          <div className="tool-header" onClick={() => setExpanded(!expanded)}>
            <span className="tool-name">
              {isCall ? `Using ${tool}...` : `${tool} result`}
            </span>
            <ChevronIcon isOpen={expanded} />
          </div>
          {expanded && result && (
            <div className="tool-content">
              <pre><code>{result}</code></pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Main Message Component
interface MessageProps {
  role: 'user' | 'system' | 'tool';
  text: string;
  command?: string;
  tool?: string;
  result?: string;
}

export const Message = React.memo(({ role, text, command, tool, result }: MessageProps) => {
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

  // Handle tool messages
  if (role === 'tool' || command === 'tool-call' || command === 'tool-result') {
    return (
      <ToolMessage
        tool={tool || 'unknown'}
        result={result || text}
        isCall={command === 'tool-call'}
      />
    );
  }

  const isUser = role === 'user';

  return (
    <div className={`message ${role}`}>
      <div className="message-wrapper">
        <div className="message-avatar">
          {isUser ? 'U' : 'AI'}
        </div>
        <div className="message-body">
          <div className="message-header">
            <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
          </div>
          <div className="message-content">
            {renderMarkdown(text)}
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
