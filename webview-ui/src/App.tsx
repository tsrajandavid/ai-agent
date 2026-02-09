
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
  ContextMenu,
  FileAutocomplete,
  SlashCommandPicker,
  ChatHistory
} from './components';
import { TaskBoard } from './components/TaskBoard';
import { TaskDocumentView } from './components/TaskDocumentView';
import type { TaskGroup } from './types/task-group';
import { formatTimeAgo } from './utils/dateUtils';
import './App.css';
import './components/TaskBoard.css';

const SUGGESTIONS = [
  "Explain this code",
  "Fix errors in this file",
  "Write tests",
  "Refactor for readability"
];

function App() {
  const { postMessage, messages, setMessages, streamingContent, setStreamingContent } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<Mode>(MODES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

  // Model State
  const [currentModel, setCurrentModel] = useState(MODELS[0]);

  // File Autocomplete State
  const [files, setFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileFilter, setFileFilter] = useState("");

  // Slash Command Picker State
  const [showSlashPicker, setShowSlashPicker] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");

  // Approval State
  const [pendingApproval, setPendingApproval] = useState<ApprovalData | null>(null);

  // Multi-Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  // Task Group State
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [currentView, setCurrentView] = useState<'chat' | 'tasks'>('chat');
  const [appRoute, setAppRoute] = useState<'sidebar-chat' | 'tasks-document'>(
    (window as any).initialRoute || 'sidebar-chat'
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeTimerRef = useRef<number>(0);



  // Handle response completion and other commands
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('[AI Agent UI] Received message:', message.command, message);

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
        console.log('[AI Agent UI] Set route:', message.route);
        setAppRoute(message.route);
      }
      if (message.command === 'update-task-list') {
        setTaskGroups(message.taskGroups || []);
        if (message.activeGroupId) {
          setActiveGroupId(message.activeGroupId);
        }
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
        if (message.activeId) {
          setActiveChatId(message.activeId);
        }
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

    // Signal ready AFTER listener is attached
    console.log('[AI Agent UI] Initializing...');
    postMessage("webview-ready", "");
    postMessage("setModel", currentModel.id);
    postMessage("refresh-files", "");

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle Input Change for Autocomplete
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Check for @mention (file picker)
    const atMatch = val.match(/@([\w/.-]*)$/);
    if (atMatch) {
      setShowFilePicker(true);
      setFileFilter(atMatch[1]);
      setShowSlashPicker(false);
    } else {
      setShowFilePicker(false);
    }

    // Check for / command (slash picker) - only at start of input
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
      const newValue = prefix + `/add ${file} `;
      setInputValue(newValue);
      setShowFilePicker(false);
      textareaRef.current?.focus();
    }
  }, [inputValue]);

  // Auto-scroll to bottom using RAF for smoother scrolling
  useEffect(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages, streamingContent, isLoading]);

  // Debounced auto-resize textarea
  useEffect(() => {
    if (resizeTimerRef.current) {
      cancelAnimationFrame(resizeTimerRef.current);
    }
    resizeTimerRef.current = requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
  }, [inputValue]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Optimistic update
    setMessages(prev => [...prev, { role: "user", text: inputValue, timestamp: Date.now() }]);
    setInputValue("");
    setIsLoading(true);
    setStreamingContent("");

    postMessage("chat", { text: inputValue, mode: mode.id, model: currentModel.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showFilePicker || showSlashPicker) {
        // Let the picker handle Enter
        return;
      }
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

  const handleApprove = (feedback?: string) => {
    if (!pendingApproval) return;
    postMessage('approval-response', { approved: true, feedback: feedback || "" });
    setPendingApproval(null);
  };

  const handleReject = (feedback?: string) => {
    if (!pendingApproval) return;
    postMessage('approval-response', { approved: false, feedback: feedback || "" });
    setPendingApproval(null);
  };

  const handleStop = () => {
    postMessage('stop-generation', "");
    setIsLoading(false);
    setStreamingContent("");
  };

  const handleHistoryParams = {
    conversations,
    activeChatId,
    onSelectChat: (id: string) => {
      setActiveChatId(id);
      postMessage('load-conversation', { id });
      setShowHistory(false);
    },
    onDeleteChat: (id: string) => {
      postMessage('delete-conversation', { id });
    },
    onNewChat: () => {
      postMessage('new-chat', "");
      setShowHistory(false);
    }
  };

  // --- RENDERING ---

  // Render Document View if route is 'tasks-document'
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
          postMessage('toggle-subtask', { groupId, subtaskId, completed });
          // Optimistic update
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
      {/* Sidebar Backdrop */}
      {showHistory && <div className="sidebar-backdrop" onClick={() => setShowHistory(false)} />}

      {/* Chat History Sidebar */}
      <ChatHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        {...handleHistoryParams}
      />

      <div className="header">
        <div className="header-left">
          <button className="icon-button" onClick={() => setShowHistory(!showHistory)} title="History">
            <span className="codicon codicon-history"></span>
          </button>
          <div className="view-switcher">
            <button
              className={`view-tab ${currentView === 'chat' ? 'active' : ''}`}
              onClick={() => setCurrentView('chat')}
            >
              Chat
            </button>
            <button
              className={`view-tab ${currentView === 'tasks' ? 'active' : ''}`}
              onClick={() => setCurrentView('tasks')}
            >
              Tasks
            </button>
          </div>
        </div>
        <div className="header-right">
          <Dropdown
            options={MODES}
            selected={mode}
            onSelect={setMode}
            className="mode-selector"
          />
          <Dropdown
            options={MODELS}
            selected={currentModel}
            onSelect={setCurrentModel}
            className="model-dropdown"
            align="right"
          />
        </div>
      </div>

      <div className="main-content">
        {currentView === 'tasks' ? (
          <TaskBoard
            taskGroups={taskGroups}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
            onToggleSubtask={(groupId, subtaskId, completed) => {
              postMessage('toggle-subtask', { groupId, subtaskId, completed });
              // Optimistic update to UI
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
            onCreateGroup={() => {
              setCurrentView('chat');
              setInputValue('/plan ');
              textareaRef.current?.focus();
            }}
          />
        ) : (
          <div className={`chat-container ${messages.length === 0 ? 'empty' : ''}`}>
            {messages.length === 0 ? (
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
                {messages.map((msg, index) => (
                  <Message
                    key={index}
                    message={msg}
                    isLast={index === messages.length - 1}
                  />
                ))}

                {streamingContent && (
                  <div className="message assistant streaming">
                    <div className="message-header">
                      <span className="role-badge">AI Assistant</span>
                    </div>
                    <div className="message-content">
                      {/* We render a thinking indicator if content is empty, or markdown otherwise */}
                      {/* For now, just render text */}
                      {/* The MarkdownRenderer handles this usually, but here we can just put a placeholder or use existing Message logic */}
                      <Message message={{ role: 'assistant', text: streamingContent }} isLast={true} />
                    </div>
                  </div>
                )}

                {isLoading && !streamingContent && (
                  <ThinkingIndicator />
                )}

                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {pendingApproval && (
        <ApprovalRequest
          data={pendingApproval}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {currentView === 'chat' && (
        <div className="input-area">
          {/* Context Menu / Settings could go here */}

          {/* Pickers */}
          {showFilePicker && (
            <FileAutocomplete
              files={files}
              filter={fileFilter}
              onSelect={handleFileSelect}
              onClose={() => setShowFilePicker(false)}
            />
          )}

          {showSlashPicker && (
            <SlashCommandPicker
              filter={slashFilter}
              onSelect={handleSlashSelect}
              onClose={() => setShowSlashPicker(false)}
            />
          )}

          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder={showFilePicker ? "Select a file..." : "Ask a question... (Type / for commands, @ to add files)"}
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
            <span>{currentModel.name}</span>
            {files.length > 0 && <span className="file-count">{files.length} context files</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
