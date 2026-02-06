import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVSCode } from './hooks/useVSCode';
import { MODES, DEFAULT_MODEL } from './constants';
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

  ChatHistory,
  TaskGroupPanel
} from './components';
import type { TaskGroup } from './types/task-group';
import { formatTimeAgo } from './utils/dateUtils';
import './App.css';

function App() {
  const { postMessage, messages, setMessages, streamingContent, setStreamingContent } = useVSCode();
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<Mode>(MODES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);

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
  const [showHistory, setShowHistory] = useState(false); // Start closed for drawer mode

  // Task Group State
  const [taskGroup, setTaskGroup] = useState<TaskGroup | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'history' | 'tasks'>('history');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set model on mount and signal ready
  useEffect(() => {
    postMessage("webview-ready", "");
    postMessage("setModel", DEFAULT_MODEL);
  }, []);

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
      if (message.command === 'update-conversation-list') {
        setConversations(message.conversations || []);
        if (message.activeId) {
          setActiveChatId(message.activeId);
        }
      }
      if (message.command === 'update-task-group') {
        console.log('[AI Agent UI] Received task group update:', message.taskGroup);
        setTaskGroup(message.taskGroup);
        // Optional: Switch to tasks tab if a new group is created?
        // setSidebarTab('tasks');
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
  };

  const handleSlashSelect = (cmd: string) => {
    // For commands that need arguments, add a space
    const needsArg = ['/add', '/remove', '/run', '/commit'].includes(cmd);
    setInputValue(needsArg ? `${cmd} ` : cmd);
    setShowSlashPicker(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (file: string) => {
    const match = inputValue.match(/@([\w/.-]*)$/);
    if (match) {
      const prefix = inputValue.substring(0, match.index);
      const newValue = prefix + `/add ${file} `;
      setInputValue(newValue);
      setShowFilePicker(false);
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

  // Close popups on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showContext && !(e.target as Element).closest('.context-menu-container')) {
        setShowContext(false);
      }
      if (showFilePicker && !(e.target as Element).closest('.file-autocomplete')) {
        setShowFilePicker(false);
      }
      if (showSlashPicker && !(e.target as Element).closest('.slash-command-picker')) {
        setShowSlashPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContext, showFilePicker, showSlashPicker]);

  const handleModeSelect = useCallback((newMode: Mode) => {
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

  // Stop generation handler
  const handleStop = useCallback(() => {
    postMessage("stop-generation", "");
    setStreamingContent("");
    setIsLoading(false);
  }, [postMessage, setStreamingContent]);

  // Chat Handlers
  const handleNewChat = () => {
    postMessage("new-chat", "");
    setInputValue("");
    if (window.innerWidth < 800) setShowHistory(false); // Auto-close on mobile
  };

  const handleSelectChat = (id: string) => {
    postMessage("load-chat", JSON.stringify({ chatId: id }));
    if (window.innerWidth < 800) setShowHistory(false);
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    postMessage("delete-chat", JSON.stringify({ chatId: id }));
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar-wrapper ${showHistory ? 'visible' : ''}`}>

        {/* Sidebar Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--vscode-widget-border)' }}>
          <button
            onClick={() => setSidebarTab('history')}
            style={{
              flex: 1,
              padding: '8px',
              background: sidebarTab === 'history' ? 'var(--vscode-tab-activeBackground)' : 'transparent',
              color: sidebarTab === 'history' ? 'var(--vscode-tab-activeForeground)' : 'var(--vscode-tab-inactiveForeground)',
              border: 'none',
              borderBottom: sidebarTab === 'history' ? '2px solid var(--vscode-tab-activeBorder)' : 'none',
              cursor: 'pointer'
            }}
          >
            History
          </button>
          <button
            onClick={() => setSidebarTab('tasks')}
            style={{
              flex: 1,
              padding: '8px',
              background: sidebarTab === 'tasks' ? 'var(--vscode-tab-activeBackground)' : 'transparent',
              color: sidebarTab === 'tasks' ? 'var(--vscode-tab-activeForeground)' : 'var(--vscode-tab-inactiveForeground)',
              border: 'none',
              borderBottom: sidebarTab === 'tasks' ? '2px solid var(--vscode-tab-activeBorder)' : 'none',
              cursor: 'pointer'
            }}
          >
            Tasks
          </button>
        </div>

        {sidebarTab === 'history' ? (
          <ChatHistory
            conversations={conversations}
            activeId={activeChatId}
            onSelect={handleSelectChat}
            onNewChat={handleNewChat}
            onDelete={handleDeleteChat}
          />
        ) : (
          <TaskGroupPanel
            taskGroup={taskGroup}
            onCreateGroup={() => postMessage('create-task-group-request', '')}
            onToggleSubtask={(id, completed) => postMessage('toggle-subtask', JSON.stringify({ groupId: taskGroup?.id, subtaskId: id, completed }))}
          />
        )}
      </div>

      <div className="main-content">
        <div className="header-mobile-toggle">
          <button onClick={() => setShowHistory(!showHistory)} className="icon-btn" title={showHistory ? "Close Menu" : "Open Menu"}>
            {showHistory ? '✕' : '☰'}
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="chat-area">
          <div className="chat-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-content">
                  <h1>Akku AI</h1>

                  {/* Recent Activity List */}
                  {conversations.length > 0 && (
                    <div className="recent-activity">
                      {conversations.slice(0, 5).map(chat => (
                        <div
                          key={chat.id}
                          className="recent-item"
                          onClick={() => handleSelectChat(chat.id)}
                        >
                          <span className="recent-title">{chat.title || "New Chat"}</span>
                          <span className="recent-time">{formatTimeAgo(chat.timestamp)}</span>
                        </div>
                      ))}
                      <div className="recent-footer">
                        <span className="see-all-link" onClick={() => setShowHistory(true)}>See all</span>
                      </div>
                    </div>
                  )}

                  {/* Disclaimer Footer */}
                  <div className="empty-footer">
                    <p>AI may make mistakes. Double-check all generated code.</p>
                  </div>
                </div>
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

            <SlashCommandPicker
              visible={showSlashPicker}
              filter={slashFilter}
              onSelect={handleSlashSelect}
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
                {isLoading ? (
                  <button
                    className="stop-btn"
                    onClick={handleStop}
                    title="Stop generation"
                  >
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    title="Send message"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}

export default App;
