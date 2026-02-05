# Developer Contribution Guide

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **VS Code**: Latest version
- **Git**

### Installation
This project consists of two parts: the VS Code Extension (backend) and the Webview UI (frontend). You need to install dependencies for both.

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd ai-agent
    ```

2.  **Install Extension Dependencies**:
    ```bash
    npm install
    ```

3.  **Install Webview UI Dependencies**:
    ```bash
    cd webview-ui
    npm install
    cd ..
    ```

---

## 🛠️ Development Workflow

The most efficient way to develop is using **Watch Mode**, which auto-recompiles changes.

### 1. Start Watch Processes
Open a terminal in VS Code and run:

**For the Extension (Backend):**
```bash
npm run watch
```
*Compiles TypeScript files in `src/` to `out/` or `dist/` on change.*

**For the Webview (Frontend):**
Open a **second terminal** (`Ctrl+Shift+5` split) and run:
```bash
cd webview-ui
npx vite build --watch
```
*Builds React files in `webview-ui/src/` to `webview-ui/build/` on change.*

### 2. Launch Extension
1.  Press **F5** (or go to *Run and Debug* -> *Run Extension*).
2.  A new "Extension Development Host" window will open.
3.  In the new window, click the **Robot Icon** in the Activity Bar to open the AI Agent.

### 3. Debugging
- **Extension Code**: Set breakpoints in `src/**/*.ts`. The debugger attaches automatically when you press F5.
- **Webview Code**: Press `Ctrl+Shift+I` (developer tools) **inside the Extension Host window** to inspect the Webview DOM and console.

---

## 📂 Project Structure

```
ai-agent/
├── src/                        # Extension Source (Node.js)
│   ├── agent/                  # AI Business Logic (System Prompts)
│   ├── llm/                    # LLM Service (OpenRouter/OpenAI)
│   ├── services/               # Core Services (Indexer, Snapshots)
│   ├── tools/                  # Tool Implementations (File, Terminal, Git)
│   │   ├── tool-manager.ts     # Tool Registration & Parsing
│   │   └── *-tools.ts          # Tool Definitions
│   ├── webview/                # Webview Provider (Bridges Extension <-> UI)
│   └── extension.ts            # Entry Point
├── webview-ui/                 # Chat UI Source (React + Vite)
│   ├── src/
│   │   ├── components/         # React Components (Chat, Message, Input)
│   │   ├── utilities/          # Helper functions
│   │   └── App.tsx             # Main App Component
│   └── index.html
├── package.json                # Extension Manifest
└── esbuild.js                  # Extension Bundler Config
```

---

## 📝 Common Tasks

### Adding a New Tool
1.  Create a new tool class in `src/tools/` implementing the `Tool` interface.
2.  Define `name`, `description`, `parameters` (JSON Schema), and `execute()` method.
3.  Set `requiresConfirmation: true` if the tool modifies files or runs commands.
4.  Register the tool in `src/extension.ts` inside `activate()`:
    ```typescript
    toolManager.registerTool(new MyNewTool(rootPath));
    ```
5.  Update `src/agent/system-prompt.ts` to list the new tool in the System Prompt (if not auto-generated).
    *(See `doc/development/Tool_system_guide.md` for details).*

### Modifying the Chat UI
1.  Edit files in `webview-ui/src/`.
2.  Ensure `npx vite build --watch` is running.
3.  Reload the Extension Host window (`Ctrl+R`) to see changes.

### Configuring LLM
- The LLM logic resides in `src/llm/llm-service.ts`.
- It currently connects to **OpenRouter**.
- API Key is stored securely via `vscode.SecretStorage`.

---

## 📦 Packaging for Release

To create a `.vsix` file for install:

1.  **Build Production Assets**:
    ```bash
    npm run build
    ```
2.  **Package**:
    ```bash
    npx vsce package
    ```
3.  **Install**:
    - Extensions view -> `...` -> "Install from VSIX..."
