import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVSCode } from './hooks/useVSCode';
import { MODES, DEFAULT_MODEL } from './constants';
import type { ApprovalData, Mode } from './types';
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
  SlashCommandPicker
} from './components';
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

  return (
    <div className="app-container">
      {/* Chat Messages Area */}
      <div className="chat-area">
        <div className="chat-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h1>AI Agent</h1>
              <p className="empty-state-hint">Ask me anything about your code, or try a quick action</p>
              <div className="empty-state-shortcuts">
                <span className="shortcut-chip" onClick={() => setInputValue('/status')}>📋 Git Status</span>
                <span className="shortcut-chip" onClick={() => setInputValue('/diff')}>📊 View Diff</span>
                <span className="shortcut-chip" onClick={() => setInputValue('create a ')}>✨ Create File</span>
                <span className="shortcut-chip" onClick={() => setInputValue('/help')}>❓ Help</span>
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
  );
}

export default App;
