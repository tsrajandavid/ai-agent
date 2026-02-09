# AI Agent Continuation Plan

## Mission Recap
We’re building an AI coding assistant as a VS Code sidebar extension that pairs a React-based chat UI with an agentic back end. The extension supports PLAN/ACT/ASK modes, streams LLM answers (OpenRouter + Gemini/Groq/Ollama fallbacks), and orchestrates tool calls rather than dumping code directly into chat (`README.md`, `src/webview/ChatPanelProvider.ts`).

## Current Architecture
- `src/extension.ts` wires up the `ToolManager`, `LLMService`, `ProjectIndexer`, task manager, and both chat/task webviews so everything shares the same services.
- Agents use `SystemPromptGenerator` + `ContextPruner` + `ConversationMemory` + `SkillLoader` to construct rich prompts before calling `LLMService` (`src/agent/system-prompt.ts`, `src/llm/llm-service.ts`).
- `ToolManager` plus file/terminal/git/task tool implementations host every tool the AI can call; each tool enforces validation/confirmation and reports back to the Webview (`src/tools/tool-manager.ts`, `src/tools/file-tools.ts`, etc.).
- Task flows live in `TaskGroupManager`, `PlanCommand`, and `ActionEngine`, while the frontend React UI mirrors state, approvals, and task documents (`src/agent/task-group-manager.ts`, `src/agent/action-engine.ts`, `webview-ui/src/App.tsx`, `webview-ui/src/components/TaskBoard.tsx`).

## Outstanding Work
- Harden the auto-execution loop and task planning UX (approval handling, retries, `task.md` sync).
- Extend the skill library under `.agent/skills` to cover more frameworks (see `SkillLoader` + `doc/agent_upgrade/skills-library.md`).
- Implement snapshot restore and surface the snapshot directory for easy rollbacks (`src/services/snapshot-service.ts`).
- Add telemetry/logging around tool executions and plan progress in case troubleshooting is needed.

## How to Continue
1. **Build/Verify** – from the repo root run `npm install` (if not yet done) and `npm run build`, then `cd webview-ui && npm run build` to refresh the Webview bundle.
2. **Maintain Tool Readiness** – ensure `ensureToolsRegistered()` and `ProjectIndexer.scanFiles()` keep running whenever the workspace changes (`src/extension.ts`, `src/services/project-indexer.ts`).
3. **Plan Workflow** – use `/plan` (or the `create_task_group` tool) to generate tidy `task.md` files and then `/continue` to trigger `create_implementation_plan` (`src/tools/task-tools.ts`, `src/commands/plan-command.ts`).
4. **Skill Expansion** – add new `SKILL.md` files under `.agent/skills` matching triggers that your project uses; `SkillLoader` only injects active skills into the prompt when dependencies or files match (`src/agent/skill-loader.ts`, `doc/agent_upgrade/skills-library.md`).

## Notes & Resources
- Reference guides: `doc/development/Vscode_extension_development_guide.md`, `doc/development/Tool_system_guide.md`, and `doc/agent_upgrade/system-prompt.md`.
- Keep the React app in sync with the extension (see `webview-ui/package.json` scripts and `main.tsx` entry point).

