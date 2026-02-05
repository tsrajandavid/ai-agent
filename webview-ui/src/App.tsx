import { useState, useRef, useEffect } from 'react';
import { useVSCode } from './hooks/useVSCode';
import './App.css';

// Mock Data
const MODES = [
  { id: "PLAN", label: "Planning", desc: "Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work" },
  { id: "ACT", label: "Fast", desc: "Agent will execute tasks directly. Use for simple tasks that can be completed faster" },
  { id: "ASK", label: "Asking", desc: "Agent will only answer questions. No tools or file system access." }
];

const MODELS = [
  "Gemini 3 Pro (High)",
  "Gemini 3 Pro (Low)",
  "Gemini 3 Flash",
  "Claude Sonnet 4.5",
  "Claude Sonnet 4.5 (Thinking)",
  "Claude Opus 4.5 (Thinking)",
  "GPT-OSS 120B (Medium)"
];

/* SVG Icons */
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
  </svg>
);

// Custom Dropdown Component
interface DropdownProps {
  label: string;
  items: any[];
  onSelect: (item: any) => void;
  type: "mode" | "model";
}

const Dropdown = ({ label, items, onSelect, type }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="custom-dropdown">
      <button className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        {label} <ChevronUpIcon />
      </button>
      {isOpen && (
        <>
          <div className="dropdown-backdrop" onClick={() => setIsOpen(false)} />
          <div className="dropdown-menu">
            {type === "mode" && <div className="dropdown-header">Conversation mode</div>}
            {items.map((item, idx) => (
              <div
                key={idx}
                className="dropdown-item"
                onClick={() => {
                  onSelect(item);
                  setIsOpen(false);
                }}
              >
                {type === "mode" ? (
                  <>
                    <div className="item-label">{item.label}</div>
                    <div className="item-desc">{item.desc}</div>
                  </>
                ) : (
                  <div className="item-label">{item}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

function App() {
  const { postMessage, messages } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState(MODES[0]); // Default to Planning
  const [model, setModel] = useState(MODELS[0]);

  const handleModeSelect = (newMode: any) => {
    setMode(newMode);
    postMessage("setMode", newMode.id);
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      postMessage("hello", inputValue);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* Auto-resize logic */
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Context Menu State
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showContext && !(e.target as Element).closest('.context-menu-container')) {
        setShowContext(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContext]);

  return (
    <div className="app-container">
      <div className="chat-area">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h1>ai-agent</h1>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-header">
                {msg.role === 'user' ? 'USER' : 'AI'}
              </div>
              <div className="message-content">
                {msg.text || JSON.stringify(msg)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="input-container">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything (Ctrl+L), @ to mention, / for workflows"
          rows={1}
        />
        <div className="input-footer">
          <div className="input-actions-left">
            <div className="context-menu-container" style={{ position: 'relative' }}>
              <button
                className={`icon-btn ${showContext ? 'active' : ''}`}
                title="Add Context"
                onClick={() => setShowContext(!showContext)}
              >
                <PlusIcon />
              </button>

              {showContext && (
                <div className="context-popup">
                  <div className="context-header">Add context</div>

                  <div className="context-item">
                    <span className="context-icon">🖼️</span>
                    <span>Media</span>
                  </div>
                  <div className="context-item">
                    <span className="context-icon">@</span>
                    <span>Mentions</span>
                  </div>
                  <div className="context-item">
                    <span className="context-icon">📝</span>
                    <span>Workflows</span>
                  </div>
                </div>
              )}
            </div>

            <Dropdown
              label={mode.label}
              items={MODES}
              onSelect={handleModeSelect}
              type="mode"
            />

            <Dropdown
              label={model}
              items={MODELS}
              onSelect={setModel}
              type="model"
            />

          </div>
          <div className="input-actions-right">
            <button className="send-btn" onClick={handleSend}>
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
