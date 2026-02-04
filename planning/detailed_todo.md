# AI Agent - Detailed Todo List

Derived from `Ai_agent_week1_final_plan.md` and `Ai_agent_week2_final_plan.md`.

## 📦 Phase 1: Foundation & Project Setup (Day 1)
- [ ] **Project Layout**
    - [x] Initialize `package.json` with dependencies (`openai`, `simple-git`, `fast-glob`, `ignore`)
    - [x] Configure `tsconfig.json` for Extension Host and Webview
    - [x] Set up `esbuild.js` for bundling
    - [x] Create directory structure (`src/agent`, `src/tools`, `src/services`, `src/llm`, `src/webview`)
- [x] **Extension Entry Point**
    - [x] Create `src/extension.ts` with `activate` and `deactivate`
    - [x] Register `ai-agent.openChat` command
    - [x] Define activation events in `package.json`
- [x] **Project Indexer (Service)**
    - [x] Implement file scanner using `fast-glob`
    - [x] Implement `.gitignore` parser using `ignore`
    - [x] Create `ProjectState` to store file tree and metadata
    - [x] Add dependency parser (read `package.json`)
    - [x] Add framework detection logic

## 💬 Phase 2: Chat UI & Mode System (Day 2)
- [x] **Webview Setup**
    - [x] Create `ChatPanelProvider` class
    - [x] Setup React app in `webview-ui/`
    - [x] Configure Vite for Webview build
    - [x] Implement message passing (`postMessage` communication)
- [x] **Mode System**
    - [x] Define modes: `PLAN`, `ACT`, `ASK`
    - [x] Create Mode Selector UI in React
    - [x] Implement mode state management in Extension Host
- [x] **Chat Interface**
    - [x] Create Message list component with Markdown rendering
    - [x] Create Input area with auto-resize
    - [x] Add "Project Context" panel in UI

## 🧠 Phase 3: LLM Integration (Day 3)
- [x] **LLM Client**
    - [x] Create `LLMService` wrapper around `openai` SDK (for OpenRouter)
    - [x] Implement API Key management using `context.secrets`
    - [x] Add Model Selector logic
- [x] **Prompt Engineering**
    - [x] Build "System Prompt" generator
    - [x] Inject Project Context (File Tree, Framework, Deps) into system prompt
    - [x] Implement grounded context (only real files)
- [x] **Streaming**
    - [x] handle streaming responses from LLM
    - [x] Forward stream chunks to Webview

## 🛠️ Phase 4: Tools & Safety (Day 4)
- [ ] **Tool System**
    - [x] Define `Tool` interface
- [x] **Tool System**
    - [x] Define `Tool` interface
    - [x] Implement `read_file`
    - [x] Implement `list_dir`
    - [x] Implement `search_code` (Stubbed for now)
    - [x] Implement `write_file`
    - [/] Implement `edit_file` (Planned for future)
- [ ] **Validation Layer**
    - [ ] Add path validation (no access outside workspace)
    - [ ] Add "Human-in-the-loop" confirmation dialogs for dangerous tools
    - [ ] Implement User Approval UI in Webview

## ⚡ Phase 5: Terminal & Git (Day 5)
- [x] **Terminal Tools**
    - [x] Implement `run_command` tool
    - [x] Capture terminal output via `shellIntegration` or `cp.exec`
- [x] **Git Integration**
    - [x] Implement `git_status`, `git_diff`, `git_log`
    - [/] Implement `git_add`, `git_commit`, `git_push` (Deferred)
- [ ] **Cost Tracking**
    - [ ] Track input/output tokens per request
    - [ ] Display session cost in UI

## 📸 Phase 6: Snapshots & Polish (Day 6)
- [x] **Snapshot System**
    - [x] Implement simple workspace backup/restore (using hidden .brain folder?)
    - [x] Create Snapshot UI (List, Restore) (Implemented as Command)
- [ ] **Persistence**
    - [ ] Save chat history to `globalState` or `workspaceState`

## 🧪 Phase 7: Testing & documentation (Day 7)
- [ ] **Verification**
    - [ ] Manual E2E test of all tools
    - [ ] Verify Mode constraints
- [x] **Docs**
    - [x] Write `README.md`
    - [x] Package `.vsix`

## 🚀 Phase 8: Advanced Features (Week 2)
- [ ] **Diff Preview** (Day 8)
    - [ ] Show side-by-side diff before applying edits
- [ ] **Code Review** (Day 9)
    - [ ] Implement `review_code` tool
    - [ ] Display diagnostics in UI
- [ ] **Smart Context** (Day 10)
    - [ ] Implement `@file` and `@folder` mentions
    - [ ] Integrate VS Code Diagnostics (Problems)
- [ ] **Multi-file Edits** (Day 11)
    - [ ] Implement batch edit tool
- [ ] **UX Polish** (Day 12-14)
    - [ ] Settings Panel
    - [ ] Onboarding Flow
    - [ ] Performance Optimization
