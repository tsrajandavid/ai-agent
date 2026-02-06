# VS Code AI Agent - Week 1 Sprint Plan

## 🎯 Week Goal
**Deliver a working AI chat extension that can read files, edit code, run commands, and do basic git operations.**

---

## 📅 Day-by-Day Breakdown

---

### Day 1: Project Setup & Extension Scaffold
**Goal**: Running extension with empty sidebar panel

#### Morning (4 hrs)
- [ ] Initialize VS Code extension
  ```bash
  npx --package yo --package generator-code -- yo code
  # Select: TypeScript, Webpack, name: "ai-agent"
  ```
- [ ] Set up project structure
  ```
  src/
    extension.ts
    agent/
    tools/
    services/
    webview/
  webview-ui/
  ```
- [ ] Configure build system (esbuild for faster builds)
- [ ] Add essential dependencies
  ```json
  {
    "@anthropic-ai/sdk": "latest",
    "simple-git": "latest"
  }
  ```

#### Afternoon (4 hrs)
- [ ] Create sidebar webview provider
- [ ] Basic HTML shell for chat UI
- [ ] Message passing setup (extension ↔ webview)
- [ ] Test: Extension loads, sidebar shows "Hello World"

#### Deliverable
```
✅ Extension activates
✅ Sidebar panel opens
✅ Can send message from webview to extension (console.log proof)
```

---

### Day 2: Chat UI (Webview)
**Goal**: Functional chat interface with message display

#### Morning (4 hrs)
- [ ] Set up React/Preact in webview-ui folder
- [ ] Create components:
  ```
  components/
    ChatContainer.tsx    # Main wrapper
    MessageList.tsx      # Scrollable message area
    MessageItem.tsx      # Single message bubble
    InputArea.tsx        # Text input + send button
  ```
- [ ] Style with Tailwind or VS Code theme variables
- [ ] Message state management (useReducer)

#### Afternoon (4 hrs)
- [ ] Markdown rendering (react-markdown)
- [ ] Code block syntax highlighting (highlight.js or Prism)
- [ ] Auto-scroll to bottom on new messages
- [ ] Loading indicator component
- [ ] Wire up send button → postMessage

#### Deliverable
```
✅ Can type message and see it appear in chat
✅ Messages styled nicely (user vs assistant)
✅ Code blocks render with syntax highlighting
```

---

### Day 3: LLM Integration
**Goal**: Chat with Claude, streaming responses

#### Morning (4 hrs)
- [ ] API key configuration
  ```typescript
  // Use VS Code settings
  vscode.workspace.getConfiguration('aiAgent').get('anthropicApiKey')
  // Or VS Code secret storage for security
  context.secrets.store('anthropic-api-key', key)
  ```
- [ ] Claude SDK setup
  ```typescript
  import Anthropic from '@anthropic-ai/sdk';
  
  const client = new Anthropic({ apiKey });
  ```
- [ ] Basic chat completion (non-streaming first)
- [ ] System prompt design

#### Afternoon (4 hrs)
- [ ] Streaming implementation
  ```typescript
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: conversationHistory,
  });
  
  for await (const chunk of stream) {
    // Send chunk to webview
  }
  ```
- [ ] Stream chunks to webview UI
- [ ] Handle stream completion
- [ ] Error handling (API errors, network issues)
- [ ] Cancel request support

#### Deliverable
```
✅ Send message → Get Claude response
✅ Response streams in real-time
✅ Errors shown gracefully in UI
```

---

### Day 4: Tool System + File Tools
**Goal**: Agent can read and edit files

#### Morning (4 hrs)
- [ ] Tool registry pattern
  ```typescript
  interface Tool {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    execute: (input: any) => Promise<ToolResult>;
  }
  
  class ToolRegistry {
    register(tool: Tool): void;
    get(name: string): Tool;
    getDefinitions(): ToolDefinition[]; // For LLM
  }
  ```
- [ ] Implement file tools:
  - `read_file` - Read file contents
  - `list_directory` - List workspace files
  - `write_file` - Create/overwrite file
  - `edit_file` - Search & replace edits

#### Afternoon (4 hrs)
- [ ] Tool execution in agent loop
  ```typescript
  // Simplified agent loop
  while (true) {
    const response = await llm.chat(messages, tools);
    
    if (response.stopReason === 'tool_use') {
      const results = await executeTools(response.toolCalls);
      messages.push({ role: 'user', content: results });
    } else {
      break; // Final response
    }
  }
  ```
- [ ] Tool call UI component (show what tool is being used)
- [ ] Tool result display in chat
- [ ] Test: "Read my package.json" works

#### Deliverable
```
✅ "What's in my package.json?" → Shows file contents
✅ "Create a hello.js file" → File created
✅ "Add a console.log to index.js" → File edited
✅ Tool calls visible in chat UI
```

---

### Day 5: Terminal + Git Tools
**Goal**: Run commands and basic git operations

#### Morning (4 hrs)
- [ ] Terminal service
  ```typescript
  class TerminalService {
    async runCommand(cmd: string, cwd?: string): Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
  }
  ```
- [ ] Implement `run_command` tool
- [ ] Output capture and display
- [ ] Timeout handling (prevent hanging)
- [ ] Security: Basic command validation

#### Afternoon (4 hrs)
- [ ] Git service (using simple-git)
  ```typescript
  class GitService {
    async status(): Promise<StatusResult>;
    async diff(staged?: boolean): Promise<string>;
    async add(files: string[]): Promise<void>;
    async commit(message: string): Promise<void>;
    async push(): Promise<void>;
    async log(count: number): Promise<LogResult>;
  }
  ```
- [ ] Git tools:
  - `git_status` - Current status
  - `git_diff` - Show changes
  - `git_add` - Stage files
  - `git_commit` - Commit with message
  - `git_push` - Push to remote

#### Deliverable
```
✅ "Run npm test" → Shows test output
✅ "What's my git status?" → Shows changed files
✅ "Commit these changes with message 'fix bug'" → Commits
✅ "Push to origin" → Pushes
```

---

### Day 6: Context & Polish
**Goal**: Smart context awareness + UX improvements

#### Morning (4 hrs)
- [ ] Auto-include context in prompts:
  - Current open file
  - Selected text
  - Workspace folder name
  - Recently edited files
- [ ] Improved system prompt with context
  ```typescript
  const systemPrompt = `You are an AI coding assistant.
  
  Current workspace: ${workspaceName}
  Current file: ${activeFile || 'none'}
  Selected text: ${selection || 'none'}
  
  Available tools: ...`;
  ```
- [ ] Token counting (avoid context overflow)

#### Afternoon (4 hrs)
- [ ] User confirmation for dangerous operations
  - Delete file → "Are you sure?"
  - Git push → "Push to origin/main?"
  - Overwrite file → "File exists, overwrite?"
- [ ] Better error messages
- [ ] Conversation history persistence (workspace storage)
- [ ] Clear chat / New conversation button
- [ ] Copy code button on code blocks

#### Deliverable
```
✅ Agent knows what file you have open
✅ "Fix the bug in this function" works with selection
✅ Dangerous operations ask for confirmation
✅ Chat history survives extension reload
```

---

### Day 7: Testing & Documentation
**Goal**: Stable, documented, ready to use

#### Morning (4 hrs)
- [ ] End-to-end testing
  - Chat flow
  - Each tool individually
  - Error scenarios
  - Streaming interruption
- [ ] Fix bugs found in testing
- [ ] Performance check (response times)

#### Afternoon (4 hrs)
- [ ] README.md
  - Features list
  - Installation instructions
  - Configuration (API key)
  - Usage examples
  - Screenshots/GIFs
- [ ] CHANGELOG.md
- [ ] Package for local install (.vsix)
  ```bash
  npx vsce package
  ```
- [ ] Optional: Record demo video

#### Deliverable
```
✅ All features work reliably
✅ Clear documentation
✅ .vsix file ready to install
✅ Demo ready to show
```

---

## 📋 Tool Summary (End of Week 1)

| Tool | Description | Status |
|------|-------------|--------|
| `read_file` | Read file contents | Day 4 |
| `write_file` | Create/overwrite file | Day 4 |
| `edit_file` | Search & replace edits | Day 4 |
| `list_directory` | List workspace files | Day 4 |
| `run_command` | Execute shell command | Day 5 |
| `git_status` | Git status | Day 5 |
| `git_diff` | Show git diff | Day 5 |
| `git_add` | Stage files | Day 5 |
| `git_commit` | Create commit | Day 5 |
| `git_push` | Push to remote | Day 5 |

---

## 🛠️ Tech Stack (Final)

```
Extension Host:
  - TypeScript
  - VS Code Extension API
  - @anthropic-ai/sdk
  - simple-git
  - esbuild (bundler)

Webview UI:
  - React 18 (or Preact for smaller bundle)
  - TypeScript
  - Tailwind CSS
  - react-markdown
  - highlight.js
  - Vite (dev server)
```

---

## ⚠️ Potential Blockers

| Risk | Mitigation |
|------|------------|
| Streaming complexity | Start with non-streaming, add streaming after |
| Webview message passing issues | Use VS Code's webview toolkit library |
| Git operations failing | Fallback to shell commands via terminal |
| Token limits | Truncate file contents, summarize context |
| API rate limits | Add retry logic, backoff |

---

## 🎯 Success Criteria (End of Week)

- [ ] Extension installs and runs without errors
- [ ] Can have a conversation with Claude
- [ ] Can read any file in workspace
- [ ] Can create and edit files
- [ ] Can run terminal commands
- [ ] Can check git status and commit changes
- [ ] UI is clean and responsive
- [ ] Works offline gracefully (shows API error)

---

## 📊 Daily Standup Template

```
Yesterday: [What I completed]
Today: [What I'm working on]
Blockers: [Any issues]
```

---

## 🚀 Quick Start Commands

```bash
# Day 1 - Initialize
npx --package yo --package generator-code -- yo code
cd ai-agent
npm install @anthropic-ai/sdk simple-git
npm run watch

# Test extension
Press F5 in VS Code

# Build webview
cd webview-ui
npm create vite@latest . -- --template react-ts
npm install
npm run dev

# Package extension
npx vsce package
```

---

*Let's build this! 🚀*