# VS Code AI Agent - Final Week 1 Plan
## Incorporating Best Practices from Copilot, Claude Code & Cline

---

## 🎯 Vision
**Build an AI coding agent that combines:**
- **Copilot's** native VS Code feel & mode system
- **Claude Code's** project understanding & checkpoints
- **Cline's** human-in-loop safety & LLM flexibility

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR AI AGENT                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LAYER 1: PROJECT UNDERSTANDING (Claude Code style)         │
│  ┌────────────────────────────────────────────────────┐     │
│  │ • File tree indexing                               │     │
│  │ • Dependency detection (package.json, etc.)        │     │
│  │ • Framework detection (React, Vue, Express...)     │     │
│  │ • Code style analysis                              │     │
│  │ • Real-time file watching                          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  LAYER 2: MODE SYSTEM (Copilot + Cline style)               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ • PLAN mode (read-only, explore, think)            │     │
│  │ • ACT mode (execute, edit, run commands)           │     │
│  │ • ASK mode (Q&A, explanations)                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  LAYER 3: SAFETY SYSTEM (Cline style)                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │ • User confirmation for dangerous ops              │     │
│  │ • Path validation (anti-hallucination)             │     │
│  │ • Workspace snapshots (rollback)                   │     │
│  │ • Cost tracking                                    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  LAYER 4: TOOL SYSTEM                                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │ • File ops (read, write, edit, search, list)       │     │
│  │ • Terminal (run commands, capture output)          │     │
│  │ • Git (status, diff, add, commit, push, log)       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  LAYER 5: LLM LAYER (OpenRouter - Cline style)              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ • Multi-provider support                           │     │
│  │ • Free model fallback                              │     │
│  │ • Streaming responses                              │     │
│  │ • Grounded system prompts                          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📅 Day-by-Day Plan

### Day 1: Foundation + Project Indexer
**Reference**: Claude Code's automatic project understanding

| Time | Task | Reference |
|------|------|-----------|
| Morning | Extension scaffold, project structure | - |
| Morning | Project Indexer: file scanner | Claude Code |
| Afternoon | Dependency parser (package.json, requirements.txt) | Claude Code |
| Afternoon | Framework detector (React, Vue, Express...) | Claude Code |
| Afternoon | Gitignore respect | Cline |

**Deliverables:**
- Extension activates
- Project indexed on startup
- Knows: files, deps, framework, language

**Key Insight from Research:**
> Claude Code "analyzes your file structure & source code ASTs"
> Cline "reads your file structure and analyzes your codebase"

---

### Day 2: Chat UI + Mode System
**Reference**: Copilot's modes + Cline's Plan/Act

| Time | Task | Reference |
|------|------|-----------|
| Morning | Webview React setup | - |
| Morning | Chat components (messages, input) | - |
| Afternoon | **Mode selector** (Plan/Act/Ask) | Copilot + Cline |
| Afternoon | Project context panel | Claude Code |
| Afternoon | Markdown + code rendering | - |

**Mode System Design:**

| Mode | Behavior | Icon |
|------|----------|------|
| **Plan** | Read-only. Explore, ask questions, no changes. | 📋 |
| **Act** | Execute. Edit files, run commands. | ⚡ |
| **Ask** | Q&A only. No tools, just conversation. | 💬 |

**Key Insight from Research:**
> Cline's Plan & Act "separates strategic thinking from implementation"
> Copilot has "Agent, Plan, Ask, and Edit" modes

---

### Day 3: LLM + Grounded Prompts
**Reference**: All three (context injection)

| Time | Task | Reference |
|------|------|-----------|
| Morning | OpenRouter client setup | Cline |
| Morning | API key configuration | - |
| Afternoon | **Grounded system prompt builder** | Claude Code |
| Afternoon | **Relevant file finder** | Copilot (@workspace) |
| Afternoon | Streaming responses | - |

**Grounded Prompt Structure:**

```
## PROJECT (This is TRUTH - do not hallucinate)
Name: {name}
Type: {type}
Framework: {framework}

## ACTUAL FILE STRUCTURE
{file_tree}

## INSTALLED DEPENDENCIES (Use ONLY these)
{dependencies}

## CURRENT CONTEXT
File: {current_file}
Selection: {selection}

## RULES
1. Only reference files that EXIST above
2. Only use dependencies LISTED above
3. Read files before editing
4. Match project code style
```

**Key Insight from Research:**
> Copilot "creates a contextual prompt by combining your prompt with workspace information, such as frameworks, languages, and dependencies"

---

### Day 4: Tools + Validation Layer
**Reference**: Cline's human-in-loop + validation

| Time | Task | Reference |
|------|------|-----------|
| Morning | Tool registry with validation | Cline |
| Morning | File tools (read, write, edit, list, search) | All |
| Afternoon | **Path validation** (anti-hallucination) | Custom |
| Afternoon | **User confirmation flow** | Cline |
| Afternoon | Tool call UI | Cline |

**Validation Layer:**

| Tool | Validation | On Fail |
|------|------------|---------|
| read_file | Path must exist | Suggest similar files |
| edit_file | Path exists + text found | Show current content |
| write_file | Directory exists | Create directory? |
| run_command | Safety whitelist | Ask confirmation |

**Human-in-Loop Design (from Cline):**

```
┌─────────────────────────────────────────┐
│  🔧 Agent wants to: edit_file           │
│                                         │
│  File: src/components/Header.tsx        │
│  Change: Add login button               │
│                                         │
│  [Show Diff]  [Approve]  [Reject]       │
└─────────────────────────────────────────┘
```

**Auto-Approve Settings (from Cline):**

| Operation | Default |
|-----------|---------|
| Read files | Auto ✅ |
| List directory | Auto ✅ |
| Search code | Auto ✅ |
| Write/Edit files | Ask ❓ |
| Run commands | Ask ❓ |
| Git operations | Ask ❓ |

**Key Insight from Research:**
> Cline "provides a human-in-the-loop GUI to approve every file change and terminal command"

---

### Day 5: Terminal + Git
**Reference**: Claude Code's git workflows

| Time | Task | Reference |
|------|------|-----------|
| Morning | Terminal service | All |
| Morning | run_command tool with safety | Cline |
| Afternoon | Git service | Claude Code |
| Afternoon | Git tools (status, diff, add, commit, push, log) | Claude Code |
| Afternoon | **Cost tracking** | Cline |

**Git Tools Design (from Claude Code):**

| Tool | Purpose |
|------|---------|
| git_status | Show current status with nice formatting |
| git_diff | Show changes (staged or unstaged) |
| git_add | Stage files (with confirmation) |
| git_commit | Create commit (suggest message) |
| git_push | Push to remote (always confirm) |
| git_log | Show recent history |

**Cost Tracking (from Cline):**

```
┌─────────────────────────────────────────┐
│  📊 Session Stats                       │
│                                         │
│  Tokens: 12,450 input / 3,200 output    │
│  Cost: $0.02                            │
│  Requests: 5                            │
└─────────────────────────────────────────┘
```

**Key Insight from Research:**
> Cline "keeps track of total tokens and API usage cost for the entire task loop"
> Claude Code has strong git integration including auto PR reviews

---

### Day 6: Snapshots + Polish
**Reference**: Claude Code checkpoints + Cline snapshots

| Time | Task | Reference |
|------|------|-----------|
| Morning | **Workspace snapshots** | Both |
| Morning | Snapshot UI (compare, restore) | Cline |
| Afternoon | Code style detection | Claude Code |
| Afternoon | Conversation persistence | All |
| Afternoon | Settings UI | - |

**Snapshot System (from Cline + Claude Code):**

```
┌─────────────────────────────────────────┐
│  📸 Snapshots                           │
│                                         │
│  #3 - Added login button     [Compare]  │
│  #2 - Created Header.tsx     [Restore]  │
│  #1 - Initial state          [Restore]  │
└─────────────────────────────────────────┘
```

**Restore Options (from Claude Code):**
- Restore code only
- Restore conversation only
- Restore both

**Key Insight from Research:**
> Claude Code: "checkpoint system automatically saves your code state before each change, and you can instantly rewind"
> Cline: "takes a snapshot of your workspace at each step"

---

### Day 7: Testing + Documentation

| Time | Task |
|------|------|
| Morning | End-to-end testing |
| Morning | Bug fixes |
| Afternoon | README with screenshots |
| Afternoon | Package .vsix |

**Testing Checklist:**
- [ ] Project indexing works
- [ ] Modes switch correctly
- [ ] Plan mode is read-only
- [ ] Act mode requires confirmation
- [ ] Path validation catches bad paths
- [ ] Snapshots save and restore
- [ ] Git operations work
- [ ] Cost tracking accurate
- [ ] Free model fallback works

---

## 🛠️ Feature Summary

### From Copilot Chat ✅
| Feature | Status |
|---------|--------|
| Mode system (Plan/Act/Ask) | Day 2 |
| Context mentions (@file) | Day 3 |
| Native VS Code feel | Day 2 |
| Inline chat | Future |

### From Claude Code ✅
| Feature | Status |
|---------|--------|
| Project understanding | Day 1 |
| Grounded prompts | Day 3 |
| Checkpoints/Snapshots | Day 6 |
| Git workflows | Day 5 |
| Subagents | Future |

### From Cline ✅
| Feature | Status |
|---------|--------|
| Plan/Act separation | Day 2 |
| Human-in-loop approval | Day 4 |
| Any LLM (OpenRouter) | Day 3 |
| Cost tracking | Day 5 |
| Workspace snapshots | Day 6 |
| Browser automation | Future |

---

## 📊 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Hallucinated paths | < 5% | Validation errors |
| Tool success rate | > 95% | Execution logs |
| User confirmations | 100% on dangerous ops | UI tracking |
| Snapshot restore | Works | Manual test |
| Mode separation | Plan = no changes | Manual test |

---

## 🚀 Unique Value Proposition

**Your agent will combine the best of all three:**

| Tool | Best Feature | You Get |
|------|--------------|---------|
| Copilot | Native feel, modes | ✅ |
| Claude Code | Project understanding | ✅ |
| Cline | Safety, flexibility | ✅ |

**Plus your focus on anti-hallucination:**
- Real file tree in every prompt
- Path validation on every tool
- Read-before-edit enforcement
- Code style matching

---

## 🎯 End of Week 1 Result

A working AI agent that:
1. **Understands your project** (files, deps, framework)
2. **Has three modes** (Plan, Act, Ask)
3. **Validates everything** (no hallucinated paths)
4. **Asks permission** (human-in-loop)
5. **Tracks costs** (budget awareness)
6. **Can rollback** (snapshots)
7. **Works with free models** (OpenRouter)

---

*Ready to build! 🚀*