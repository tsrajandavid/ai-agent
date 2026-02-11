
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useVSCode } from './hooks/useVSCode';
import { MODES, MODELS } from './constants';
import type { ApprovalData, Mode, Conversation } from './types';
import {
  SendIcon,
  PlusIcon,
  StopIcon,
  Message,
  ThinkingIndicator,
  ApprovalRequest,
  Dropdown,
  FileAutocomplete,
  SlashCommandPicker,
  ChatHistory
} from './components';
import { TaskDocumentView } from './components/TaskDocumentView';
import type { TaskGroup } from './types/task-group';
import './App.css';

const SUGGESTIONS = [
  "Explain this code",
  "Fix errors in this file",
  "Write tests",
  "Refactor for readability"
];

// Messages to hide from chat display
const HIDDEN_COMMANDS = new Set(['tool-call', 'tool-result']);

function App() {
  const { postMessage, messages, setMessages, streamingContent, setStreamingContent } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<Mode>(MODES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const [currentModel, setCurrentModel] = useState(MODELS[0]);

  const [files, setFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileFilter, setFileFilter] = useState("");

  const [showSlashPicker, setShowSlashPicker] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");

  const [pendingApproval, setPendingApproval] = useState<ApprovalData | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [showSidebar, setShowSidebar] = useState(false);

  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [appRoute, setAppRoute] = useState<'sidebar-chat' | 'tasks-document'>(
    (window as any).initialRoute || 'sidebar-chat'
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeTimerRef = useRef<number>(0);

  // Filter: hide tool-call and tool-result from chat
  const visibleMessages = useMemo(() =>
    messages.filter(msg => !HIDDEN_COMMANDS.has(msg.command || '')),
    [messages]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === 'response-complete' || message.command === 'error' || message.command === 'generation-stopped') {
        setIsLoading(false);
      }
      if (message.command === 'clear-chat') {
        setMessages([]);
        setStreamingContent("");
        setIsLoading(false);
        postMessage("clear-history", "");
      }
      if (message.command === 'update-file-list') {
        setFiles(message.files || []);
      }
      if (message.command === 'set-route') {
        setAppRoute(message.route);
      }
      if (message.command === 'update-task-list') {
        setTaskGroups(message.taskGroups || []);
        if (message.activeGroupId) setActiveGroupId(message.activeGroupId);
      }
      if (message.command === 'approval-request') {
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
        if (message.messages && Array.isArray(message.messages)) {
          setMessages(message.messages);
        }
      }
      if (message.command === 'update-conversation-list') {
        setConversations(message.conversations || []);
        if (message.activeId) setActiveChatId(message.activeId);
      }
      if (message.command === 'update-task-group') {
        setTaskGroups(prev => {
          const idx = prev.findIndex(g => g.id === message.taskGroup.id);
          if (idx >= 0) {
            const newGroups = [...prev];
            newGroups[idx] = message.taskGroup;
            return newGroups;
          }
          return [...prev, message.taskGroup];
        });
      }
    };
    window.addEventListener('message', handleMessage);

    postMessage("webview-ready", "");
    postMessage("setModel", currentModel.id);
    postMessage("refresh-files", "");

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Sync mode and model with backend when they change
  useEffect(() => {
    postMessage("setMode", mode.id);
  }, [mode.id]);

  useEffect(() => {
    postMessage("setModel", currentModel.id);
  }, [currentModel.id]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const atMatch = val.match(/@([\w/.-]*)$/);
    if (atMatch) {
      setShowFilePicker(true);
      setFileFilter(atMatch[1]);
      setShowSlashPicker(false);
    } else {
      setShowFilePicker(false);
    }

    if (val.startsWith('/')) {
      setShowSlashPicker(true);
      setSlashFilter(val);
      setShowFilePicker(false);
    } else {
      setShowSlashPicker(false);
    }
  }, []);

  const handleSlashSelect = useCallback((cmd: string) => {
    const needsArg = ['/add', '/remove', '/run', '/commit'].includes(cmd);
    setInputValue(needsArg ? `${cmd} ` : cmd);
    setShowSlashPicker(false);
    textareaRef.current?.focus();
  }, []);

  const handleFileSelect = useCallback((file: string) => {
    const match = inputValue.match(/@([\w/.-]*)$/);
    if (match) {
      const prefix = inputValue.substring(0, match.index);
      setInputValue(prefix + `/add ${file} `);
      setShowFilePicker(false);
      textareaRef.current?.focus();
    }
  }, [inputValue]);

  useEffect(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages, streamingContent, isLoading]);

  useEffect(() => {
    if (resizeTimerRef.current) cancelAnimationFrame(resizeTimerRef.current);
    resizeTimerRef.current = requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
  }, [inputValue]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Add user message locally
    setMessages(prev => [...prev, { command: 'newMessage', role: "user", text: inputValue, timestamp: Date.now() }]);
    setInputValue("");
    setIsLoading(true);
    setStreamingContent("");

    // Send to backend — "hello" matches ChatPanelProvider switch case
    postMessage("hello", inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showFilePicker || showSlashPicker) return;
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setShowFilePicker(false);
      setShowSlashPicker(false);
      setShowContext(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    textareaRef.current?.focus();
  };

  const handleApprove = () => {
    if (!pendingApproval) return;
    postMessage('approval-response', JSON.stringify({ approved: true }));
    setPendingApproval(null);
  };

  const handleReject = () => {
    if (!pendingApproval) return;
    postMessage('approval-response', JSON.stringify({ approved: false }));
    setPendingApproval(null);
  };

  const handleStop = () => {
    postMessage('stop-generation', "");
    setIsLoading(false);
    setStreamingContent("");
  };

  // --- RENDERING ---

  if (appRoute === 'tasks-document') {
    const activeGroup = taskGroups.find(g => g.id === activeGroupId) || taskGroups[0];
    if (!activeGroup) {
      return (
        <div className="task-document-container">
          <div className="empty-state">
            <h2>No Active Plan</h2>
            <p>Create a plan in the chat sidebar first.</p>
          </div>
        </div>
      );
    }
    return (
      <TaskDocumentView
        taskGroup={activeGroup}
        onToggleSubtask={(groupId, subtaskId, completed) => {
          postMessage('toggle-subtask', JSON.stringify({ groupId, subtaskId, completed }));
          setTaskGroups(prev => prev.map(g => {
            if (g.id === groupId) {
              return {
                ...g,
                subtasks: g.subtasks.map(t =>
                  t.id === subtaskId ? { ...t, status: completed ? 'completed' : 'not-started' } : t
                )
              };
            }
            return g;
          }));
        }}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setShowSidebar(!showSidebar)}
        title={showSidebar ? 'Hide history' : 'Show history'}
      >
        {showSidebar ? '\u2715' : '\u2630'}
      </button>

      {/* History sidebar */}
      {showSidebar && (
        <>
          <div className="sidebar-backdrop" onClick={() => setShowSidebar(false)} />
          <div className="sidebar-panel">
            <ChatHistory
              conversations={conversations}
              activeId={activeChatId}
              onSelect={(id: string) => {
                setActiveChatId(id);
                postMessage('load-chat', JSON.stringify({ chatId: id }));
                setShowSidebar(false);
              }}
              onDelete={(id: string, e: React.MouseEvent) => {
                e.stopPropagation();
                postMessage('delete-chat', JSON.stringify({ chatId: id }));
              }}
              onNewChat={() => {
                postMessage('new-chat', "");
                setShowSidebar(false);
              }}
            />
          </div>
        </>
      )}

      {/* Header */}
      <div className="header">
        <div className="header-left">
          <span className="header-title">Akku AI</span>
        </div>
        <div className="header-right">
          <Dropdown
            label={mode.label}
            items={MODES}
            selectedId={mode.id}
            onSelect={setMode}
            position="bottom"
          />
          <Dropdown
            label={currentModel.label}
            items={MODELS as any}
            selectedId={currentModel.id}
            onSelect={(item: any) => setCurrentModel(item)}
            position="bottom"
          />
        </div>
      </div>

      {/* Main chat */}
      <div className="main-content">
        <div className={`chat-container ${visibleMessages.length === 0 ? 'empty' : ''}`}>
          {visibleMessages.length === 0 ? (
            <div className="welcome-message">
              <h1>How can I help you today?</h1>
              <p className="subtitle">I can explain code, fix bugs, or generate tests.</p>
              <div className="suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {visibleMessages.map((msg, index) => (
                <Message
                  key={index}
                  role={msg.role}
                  text={msg.text || ''}
                  command={msg.command}
                  tool={msg.tool}
                  result={msg.result}
                />
              ))}

              {streamingContent && (
                <Message role="system" text={streamingContent} />
              )}

              {isLoading && !streamingContent && (
                <ThinkingIndicator />
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Approval */}
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

      {/* Input */}
      <div className="input-area">
        <FileAutocomplete
          files={files}
          visible={showFilePicker}
          filter={fileFilter}
          onSelect={handleFileSelect}
        />
        <SlashCommandPicker
          visible={showSlashPicker}
          filter={slashFilter}
          onSelect={handleSlashSelect}
        />

        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder="Ask a question... (/ for commands, @ for files)"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!!pendingApproval}
          />
          <div className="input-controls">
            <button
              className="icon-button"
              onClick={() => setShowContext(!showContext)}
              title="Add Context"
            >
              <PlusIcon />
            </button>
            {isLoading ? (
              <button className="send-button stop" onClick={handleStop} title="Stop">
                <StopIcon />
              </button>
            ) : (
              <button
                className="send-button"
                onClick={handleSend}
                disabled={!inputValue.trim() || !!pendingApproval}
              >
                <SendIcon />
              </button>
            )}
          </div>
        </div>
        <div className="footer-info">
          <span>{currentModel.label}</span>
          {files.length > 0 && <span className="file-count">{files.length} files</span>}
        </div>
      </div>
    </div>
  );
}

export default App;
