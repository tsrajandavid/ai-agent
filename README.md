# AI Coding Agent for VS Code

An advanced AI coding assistant that lives in your sidebar. It helps you **Plan**, **Act**, and **Ask** questions about your codebase using external LLMs (via OpenRouter).

## Features

- **💬 Chat Interface**: Integrated webview chat with markdown support.
- **🧠 Mode System**:
  - **PLAN**: Analyze requirements and create implementation plans without modifying code.
  - **ACT**: Execute plans by creating, editing, and managing files.
  - **ASK**: Answer questions about your project structure and dependencies.
- **🛠️ Tools**:
  - **FileOps**: Read, write, and list files.
  - **Terminal**: Execute shell commands safely.
  - **Git**: Check status, diffs, and logs.
  - **Snapshots**: Create backups of your workspace state before making changes.
- **⚡ LLM Integration**: fast-streamed responses using OpenRouter (default: Gemini Flash 2.0).

## Installation

1. Install the `.vsix` file manually in VS Code.
2. Or run from source:
   ```bash
   npm install
   npm run build
   F5 to launch Extension Host
   ```

## Configuration

This extension requires an **OpenRouter API Key**.

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run `AI Agent: Set API Key`.
3. Paste your OpenRouter API Key.

## Usage

1. Open the **AI Agent** view in the Activity Bar / Sidebar.
2. Select a mode:
   - **PLAN**: "How should I structure a React component for a Todo list?"
   - **ACT**: "Create a file named `src/components/Todo.tsx` with a functional component."
   - **ASK**: "What frameworks are detected in this project?"
3. Use the **Snapshot** command (`AI Agent: Create Snapshot`) before running complex tasks to save your work.

## Development

### Build
```bash
npm run build
```

### Watch
```bash
npm run watch
```

## Tools Available
- `read_file`, `write_file`, `list_dir`
- `run_command`
- `git_status`, `git_diff`, `git_log`

## License
MIT
