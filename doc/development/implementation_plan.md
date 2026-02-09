# Implementation Plan - Task File Workflow

The goal is to automate the creation, sync, and opening of a `task.md` file when a plan is generated, and to support a natural language "continue" command to start execution.

## User Review Required
> [!IMPORTANT]
> - Root `task.md`: I will sync the active plan to a file named `task.md` in your project's root directory for easy access.
- Auto-Open: The file will automatically open in a new editor tab after `/plan` finishes.
- "continue" trigger: Typing "continue" in the chat will behave exactly like the `/resume` command.

## Proposed Changes

### Task Management
#### [MODIFY] [markdown-mirror.ts](file:///c:/Users/Rajan/workspace/AI/ai-agent/src/agent/markdown-mirror.ts)
- Add logic to write the sync content to `${workspaceRoot}/task.md` whenever `sync` is called for an in-progress task.
- Ensure only one `task.md` exists at the root representing the active task.

#### [MODIFY] [task-group-manager.ts](file:///c:/Users/Rajan/workspace/AI/ai-agent/src/agent/task-group-manager.ts)
- Add a helper method to return the absolute path of the root `task.md`.
- **Reliability Fix:** Update `generateSubtasks` to use a system prompt and more robust JSON extraction to prevent failures with local models.

### User Interface & Commands
#### [MODIFY] [plan-command.ts](file:///c:/Users/Rajan/workspace/AI/ai-agent/src/commands/plan-command.ts)
- After the plan is created and synced, call `vscode.workspace.openTextDocument` and `vscode.window.showTextDocument` to reveal the file.

#### [MODIFY] [ChatPanelProvider.ts](file:///c:/Users/Rajan/workspace/AI/ai-agent/src/webview/ChatPanelProvider.ts)
- In `handleUserMessage`, add a check: if the message is "continue" (case-insensitive), treat it as if the user typed `/resume`.

## Verification Plan
### Automated Tests
- None (Visual verification required for file opening).

### Manual Verification
1. Type a message like "create next js project".
2. Verify that a `task.md` file appears in the root of the workspace.
3. Verify that the file opens in a new editor tab automatically.
4. Verify that typing "continue" in the chat starts the implementation loop.
