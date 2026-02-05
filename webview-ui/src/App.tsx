import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVSCode } from './hooks/useVSCode';
import './App.css';

// Mode definitions
const MODES = [
  { id: "PLAN", label: "Planning", desc: "Agent analyzes and plans before executing. Best for complex tasks." },
  { id: "ACT", label: "Fast", desc: "Direct execution without planning. Best for simple tasks." },
  { id: "ASK", label: "Ask", desc: "Answer questions only. No file modifications." }
];

const DEFAULT_MODEL = "Qwen 2.5 Coder 3B (Local)";

/* ============================================
   SVG ICONS
   ============================================ */
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

/* ============================================
   CODE BLOCK COMPONENT
   ============================================ */
interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{language || 'code'}</span>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
};

/* ============================================
   MARKDOWN RENDERER
   ============================================ */
const renderMarkdown = (text: string): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];

  // Split by code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before the code block
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      elements.push(...renderInlineContent(textBefore, keyIndex));
      keyIndex += 100;
    }

    // Add the code block
    const language = match[1] || '';
    const code = match[2].trim();
    elements.push(<CodeBlock key={`code-${keyIndex++}`} code={code} language={language} />);

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < text.length) {
    elements.push(...renderInlineContent(text.slice(lastIndex), keyIndex));
  }

  return elements;
};

const renderInlineContent = (text: string, startKey: number): React.ReactNode[] => {
  const elements: React.ReactNode[] = [];
  let keyIndex = startKey;

  // Split by paragraphs (double newlines)
  const paragraphs = text.split(/\n\n+/);

  paragraphs.forEach((paragraph) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;

    // Check for headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/m);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level === 1) {
        elements.push(<h1 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h2>);
      } else if (level === 3) {
        elements.push(<h3 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h3>);
      } else {
        elements.push(<h4 key={`h-${keyIndex++}`}>{renderInlineFormatting(content)}</h4>);
      }
      return;
    }

    // Check for bullet lists
    if (/^[\s]*[-*]\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(line => /^[\s]*[-*]\s/.test(line));
      elements.push(
        <ul key={`ul-${keyIndex++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item.replace(/^[\s]*[-*]\s+/, ''))}</li>
          ))}
        </ul>
      );
      return;
    }

    // Check for numbered lists
    if (/^[\s]*\d+\.\s/.test(trimmed)) {
      const items = trimmed.split(/\n/).filter(line => /^[\s]*\d+\.\s/.test(line));
      elements.push(
        <ol key={`ol-${keyIndex++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item.replace(/^[\s]*\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      );
      return;
    }

    // Regular paragraph
    elements.push(<p key={`p-${keyIndex++}`}>{renderInlineFormatting(trimmed)}</p>);
  });

  return elements;
};

const renderInlineFormatting = (text: string): React.ReactNode => {
  // Handle inline code, bold, italic
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Process inline code first
  const inlineCodeRegex = /`([^`]+)`/g;
  let lastIdx = 0;
  let codeMatch;

  while ((codeMatch = inlineCodeRegex.exec(text)) !== null) {
    if (codeMatch.index > lastIdx) {
      parts.push(formatBoldItalic(text.slice(lastIdx, codeMatch.index), key++));
    }
    parts.push(<code key={`ic-${key++}`}>{codeMatch[1]}</code>);
    lastIdx = codeMatch.index + codeMatch[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(formatBoldItalic(text.slice(lastIdx), key++));
  }

  return parts.length > 0 ? parts : text;
};

const formatBoldItalic = (text: string, key: number): React.ReactNode => {
  // Bold: **text** or __text__
  // Italic: *text* or _text_
  let result: React.ReactNode = text;

  // Handle bold
  result = text.replace(/\*\*(.+?)\*\*/g, '<<BOLD>>$1<<ENDBOLD>>');

  if (typeof result === 'string' && result.includes('<<BOLD>>')) {
    const parts = result.split(/(<<BOLD>>.*?<<ENDBOLD>>)/g);
    return (
      <span key={`bf-${key}`}>
        {parts.map((part, idx) => {
          if (part.startsWith('<<BOLD>>')) {
            return <strong key={idx}>{part.replace(/<<BOLD>>|<<ENDBOLD>>/g, '')}</strong>;
          }
          return part;
        })}
      </span>
    );
  }

  return result;
};

/* ============================================
   THINKING INDICATOR COMPONENT
   ============================================ */
const ThinkingIndicator = () => (
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

/* ============================================
   MESSAGE COMPONENT
   ============================================ */
interface MessageProps {
  role: 'user' | 'system';
  text: string;
}

const Message = ({ role, text }: MessageProps) => {
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
    </div>
  );
};

/* ============================================
   DROPDOWN COMPONENT
   ============================================ */
interface DropdownProps {
  label: string;
  items: typeof MODES;
  selectedId: string;
  onSelect: (item: typeof MODES[0]) => void;
}

const Dropdown = ({ label, items, selectedId, onSelect }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="custom-dropdown">
      <button
        className={`dropdown-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {label}
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        <>
          <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />
          <div className="dropdown-menu">
            <div className="dropdown-header">Conversation Mode</div>
            {items.map((item) => (
              <div
                key={item.id}
                className={`dropdown-item ${item.id === selectedId ? 'selected' : ''}`}
                onClick={() => {
                  onSelect(item);
                  setIsOpen(false);
                }}
              >
                <div className="item-label">{item.label}</div>
                <div className="item-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ============================================
   CONTEXT MENU COMPONENT
   ============================================ */
interface ContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContextMenu = ({ isOpen, onClose }: ContextMenuProps) => {
  if (!isOpen) return null;

  return (
    <div className="context-popup">
      <div className="context-header">Add Context</div>
      <div className="context-item" onClick={onClose}>
        <span className="context-icon">📁</span>
        <span>Files</span>
      </div>
      <div className="context-item" onClick={onClose}>
        <span className="context-icon">@</span>
        <span>Mentions</span>
      </div>
      <div className="context-item" onClick={onClose}>
        <span className="context-icon">⚡</span>
        <span>Commands</span>
      </div>
    </div>
  );
};

/* ============================================
   MAIN APP COMPONENT
   ============================================ */
function App() {
  const { postMessage, messages, streamingContent } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set model on mount
  useEffect(() => {
    postMessage("setModel", DEFAULT_MODEL);
  }, []);

  // Handle response completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'response-complete' || message.command === 'error') {
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showContext && !(e.target as Element).closest('.context-menu-container')) {
        setShowContext(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContext]);

  const handleModeSelect = useCallback((newMode: typeof MODES[0]) => {
    setMode(newMode);
    postMessage("setMode", newMode.id);
  }, [postMessage]);

  const handleSend = useCallback(() => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput && !isLoading) {
      setIsLoading(true);
      postMessage("hello", trimmedInput);
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [inputValue, isLoading, postMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="app-container">
      {/* Chat Messages Area */}
      <div className="chat-area">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h1>AI Agent</h1>
              <p className="empty-state-hint">Ask me anything about your code</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <Message
                  key={index}
                  role={msg.role as 'user' | 'system'}
                  text={msg.text || JSON.stringify(msg)}
                />
              ))}
            </>
          )}

          {/* Streaming content */}
          {streamingContent && (
            <Message role="system" text={streamingContent} />
          )}

          {/* Thinking indicator */}
          {isLoading && !streamingContent && <ThinkingIndicator />}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Container */}
      <div className="input-wrapper">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
            rows={1}
            disabled={isLoading}
          />

          <div className="input-footer">
            <div className="input-actions-left">
              {/* Context Menu Button */}
              <div className="context-menu-container">
                <button
                  className={`icon-btn ${showContext ? 'active' : ''}`}
                  title="Add Context"
                  onClick={() => setShowContext(!showContext)}
                >
                  <PlusIcon />
                </button>
                <ContextMenu isOpen={showContext} onClose={() => setShowContext(false)} />
              </div>

              {/* Mode Dropdown */}
              <Dropdown
                label={mode.label}
                items={MODES}
                selectedId={mode.id}
                onSelect={handleModeSelect}
              />

              {/* Model Badge */}
              <div className="model-badge">
                <span className="status-dot"></span>
                <span>Qwen 3B</span>
              </div>
            </div>

            <div className="input-actions-right">
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                title="Send message"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
