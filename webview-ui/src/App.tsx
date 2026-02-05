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
   TOOL MESSAGE COMPONENT
   ============================================ */
interface ToolMessageProps {
  tool: string;
  result?: string;
  isCall?: boolean;
}

const ToolMessage = ({ tool, result, isCall }: ToolMessageProps) => {
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
};

/* ============================================
   APPROVAL REQUEST COMPONENT
   ============================================ */
interface ApprovalRequestProps {
  tool: string;
  filePath: string;
  oldContent?: string;
  newContent?: string;
  oldString?: string;
  newString?: string;
  onApprove: () => void;
  onReject: () => void;
}

const ApprovalRequest = ({
  tool,
  filePath,
  oldContent,
  newContent,
  oldString,
  newString,
  onApprove,
  onReject
}: ApprovalRequestProps) => {
  const [showDiff, setShowDiff] = useState(true);

  // Determine what to show
  const isEdit = tool === 'edit_file';
  const isNewFile = !oldContent || oldContent.trim() === '';

  // Get display content
  const displayOld = isEdit ? oldString : oldContent;
  const displayNew = isEdit ? newString : newContent;

  // Get file extension for syntax hint
  const ext = filePath.split('.').pop() || '';

  return (
    <div className="message approval">
      <div className="message-wrapper">
        <div className="message-avatar approval-avatar">⚡</div>
        <div className="message-body">
          <div className="approval-header">
            <span className="approval-title">
              {isEdit ? 'Edit File' : isNewFile ? 'Create File' : 'Overwrite File'}
            </span>
            <span className="approval-path">{filePath}</span>
          </div>

          <div className="approval-diff-container">
            <div className="diff-toolbar">
              <button
                className={`diff-tab ${showDiff ? 'active' : ''}`}
                onClick={() => setShowDiff(true)}
              >
                Changes
              </button>
              <button
                className={`diff-tab ${!showDiff ? 'active' : ''}`}
                onClick={() => setShowDiff(false)}
              >
                Preview
              </button>
              <span className="diff-file-type">{ext.toUpperCase()}</span>
            </div>

            {showDiff ? (
              <div className="diff-view">
                {displayOld && (
                  <div className="diff-section removed">
                    <div className="diff-label">- Removed</div>
                    <pre><code>{displayOld}</code></pre>
                  </div>
                )}
                {displayNew && (
                  <div className="diff-section added">
                    <div className="diff-label">+ Added</div>
                    <pre><code>{displayNew}</code></pre>
                  </div>
                )}
                {!displayOld && !displayNew && (
                  <div className="diff-empty">No changes to preview</div>
                )}
              </div>
            ) : (
              <div className="preview-view">
                <pre><code>{displayNew || newContent || ''}</code></pre>
              </div>
            )}
          </div>

          <div className="approval-actions">
            <button className="approval-btn reject" onClick={onReject}>
              ✕ Reject
            </button>
            <button className="approval-btn accept" onClick={onApprove}>
              ✓ Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================
   MESSAGE COMPONENT
   ============================================ */
interface MessageProps {
  role: 'user' | 'system' | 'tool';
  text: string;
  command?: string;
  tool?: string;
  result?: string;
}

const Message = ({ role, text, command, tool, result }: MessageProps) => {
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
   FILE AUTOCOMPLETE COMPONENT
   ============================================ */
interface FileListProps {
  files: string[];
  visible: boolean;
  filter: string;
  onSelect: (file: string) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx': return <span style={{ color: '#3178c6' }}>TS</span>;
    case 'js':
    case 'jsx': return <span style={{ color: '#f1e05a' }}>JS</span>;
    case 'css': return <span style={{ color: '#563d7c' }}>#</span>;
    case 'json': return <span style={{ color: '#e34c26' }}>{ }</span>;
    case 'md': return <span style={{ color: '#008ba3' }}>M↓</span>;
    case 'html': return <span style={{ color: '#e34c26' }}>&lt;&gt;</span>;
    default: return <span>📄</span>;
  }
};

const FileAutocomplete = ({ files, visible, filter, onSelect }: FileListProps) => {
  if (!visible) return null;

  // Filter files
  const filtered = files.filter(f => f.toLowerCase().includes(filter.toLowerCase())).slice(0, 8);

  return (
    <div className="file-autocomplete">
      <div className="context-menu-header">
        <span>Code Context Items</span>
        <span className="arrow">→</span>
      </div>

      {/* Categories (Static for now to match UI look) */}
      {!filter && (
        <>
          <div className="context-category">
            <span className="cat-icon">📁</span> Files
          </div>
          <div className="context-category">
            <span className="cat-icon">📂</span> Directories
          </div>
        </>
      )}

      {/* Filtered Files */}
      {filtered.length > 0 ? (
        <div className="file-list-section">
          {filtered.map((file, idx) => (
            <div key={idx} className="autocomplete-item" onClick={() => onSelect(file)}>
              <div className="file-icon-wrapper">{getFileIcon(file)}</div>
              <span className="file-name">{file}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="autocomplete-empty">No matching files</div>
      )}
    </div>
  );
};

/* ============================================
   MAIN APP COMPONENT
   ============================================ */
function App() {
  const { postMessage, messages, setMessages, streamingContent, setStreamingContent } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // File Autocomplete State
  const [files, setFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileFilter, setFileFilter] = useState("");

  // Approval State
  const [pendingApproval, setPendingApproval] = useState<{
    tool: string;
    filePath: string;
    oldContent?: string;
    newContent?: string;
    oldString?: string;
    newString?: string;
  } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set model on mount
  useEffect(() => {
    postMessage("setModel", DEFAULT_MODEL);
  }, []);

  // Handle response completion and other commands
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[AI Agent UI] Received message:', message.command, message);

      if (message.command === 'response-complete' || message.command === 'error') {
        setIsLoading(false);
      }
      if (message.command === 'clear-chat') {
        setMessages([]);
        setStreamingContent("");
        setIsLoading(false);
        postMessage("clear-history", "");
      }
      if (message.command === 'update-file-list') {
        console.log('[AI Agent UI] Received file list:', message.files?.length);
        setFiles(message.files || []);
      }
      if (message.command === 'approval-request') {
        console.log('[AI Agent UI] Approval request received:', message);
        setPendingApproval({
          tool: message.tool,
          filePath: message.filePath,
          oldContent: message.oldContent,
          newContent: message.newContent,
          oldString: message.oldString,
          newString: message.newString
        });
      }
      if (message.command === 'restore-history') {
        console.log('[AI Agent UI] Restoring history:', message.messages?.length, 'messages');
        if (message.messages && Array.isArray(message.messages)) {
          setMessages(message.messages);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // Request initial file list
    postMessage("refresh-files", "");

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle Input Change for Autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Check for @mention
    const match = val.match(/@([\w/.-]*)$/);
    if (match) {
      setShowFilePicker(true);
      setFileFilter(match[1]);
    } else {
      setShowFilePicker(false);
    }
  };

  const handleFileSelect = (file: string) => {
    // Replace @filter with /add file
    // Or just insert the file path? 
    // User wants context management. Let's convert to slash command or just insert path?
    // Let's insert `/add <path> `
    const match = inputValue.match(/@([\w/.-]*)$/);
    if (match) {
      const prefix = inputValue.substring(0, match.index);
      // If strictly at start, replace with command. Else just text? 
      // The user asked for "Context Management".
      // Let's replace with `/add ${file}` only if text is empty?
      // Actually, inserting `/add path` at cursor is weird if there's other text.
      // Let's assume user starts with @ or types it.
      // Simplest: replace `@partial` with `/add ${file}` if it's the only thing, or just the path if inline.
      // But `/add` triggers the backend logic.

      // Let's try: Replace with `/add ${file}` and clear the rest if it's the start.
      // Or just append ` ${file} `?
      // Wait, existing implementation requires `/add <path>`.
      // So if I replace `@...` with `/add file`, it works.

      const newValue = prefix + `/add ${file} `;
      setInputValue(newValue);
      setShowFilePicker(false);

      // Focus back
      textareaRef.current?.focus();
    }
  };

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
      if (showFilePicker && !(e.target as Element).closest('.file-autocomplete')) {
        setShowFilePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContext, showFilePicker]);

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
      // If picker is open, select first? Nah, just close
      if (showFilePicker) return;
      handleSend();
    }
  }, [handleSend, showFilePicker]);

  // Approval handlers
  const handleApprove = useCallback(() => {
    postMessage("approval-response", JSON.stringify({ approved: true }));
    setPendingApproval(null);
  }, [postMessage]);

  const handleReject = useCallback(() => {
    postMessage("approval-response", JSON.stringify({ approved: false }));
    setPendingApproval(null);
  }, [postMessage]);

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
                  role={msg.role as 'user' | 'system' | 'tool'}
                  text={msg.text || ''}
                  command={msg.command}
                  tool={msg.tool}
                  result={msg.result}
                />
              ))}
            </>
          )}

          {/* Streaming content */}
          {streamingContent && (
            <Message role="system" text={streamingContent} />
          )}

          {/* Thinking indicator */}
          {isLoading && !streamingContent && !pendingApproval && <ThinkingIndicator />}

          {/* Approval Request */}
          {pendingApproval && (
            <ApprovalRequest
              tool={pendingApproval.tool}
              filePath={pendingApproval.filePath}
              oldContent={pendingApproval.oldContent}
              newContent={pendingApproval.newContent}
              oldString={pendingApproval.oldString}
              newString={pendingApproval.newString}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Container */}
      <div className="input-wrapper">
        <div className="input-container">

          <FileAutocomplete
            files={files}
            visible={showFilePicker}
            filter={fileFilter}
            onSelect={handleFileSelect}
          />

          <textarea
            ref={textareaRef}
            className="chat-input"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Use @ to add context)"
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
