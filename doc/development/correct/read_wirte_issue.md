
Current Behavior (Wrong) ❌

┌─────────────────────────────────────────┐
│ Chat Window                             │
│                                         │
│ User: Create chess game                 │
│                                         │
│ Agent: Here's the code...               │
│ ```javascript                           │
│ const board = document...               │  ← Code shown in chat
│ ```                                     │
│                                         │
│ "This is a barebones implementation..." │
└─────────────────────────────────────────┘


Expected Behavior (Correct) ✅

┌─────────────────────────────────────────┐
│ Chat Window                             │
│                                         │
│ User: Create chess game                 │
│                                         │
│ Agent: I'll create a chess game.        │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📄 Creating: script.js              │ │
│ │                                     │ │
│ │ [View Diff]  [Approve]  [Reject]    │ │  ← Approval UI
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📄 Creating: styles.css             │ │
│ │                                     │ │
│ │ [View Diff]  [Approve]  [Reject]    │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘


1. System Prompt Change
Tell the agent to use tools instead of writing code in chat:
IMPORTANT: Never write code directly in chat messages.

Instead, use the write_file or edit_file tools to create/modify files.

When user asks to create code:
1. Use write_file tool for each file
2. Wait for user approval
3. Confirm what was created

DO NOT output code blocks in your response. USE TOOLS.

2. Tool Usage Flow
User: "Create chess game"
         │
         ▼
Agent thinks: "I need to create 3 files"
         │
         ▼
Agent calls: write_file("index.html", "<!DOCTYPE html>...")
         │
         ▼
Your Extension: Shows approval UI
         │
         ▼
User clicks: [Approve]
         │
         ▼
File created on disk
         │
         ▼
Agent calls: write_file("styles.css", "...")
         │
         ▼
... repeat for each file


 Updated System Prompt

 You are an AI coding assistant in VS Code.

## CRITICAL RULE
NEVER write code in chat messages. ALWAYS use tools to create files.

## When Creating Code:
1. Use write_file tool for NEW files
2. Use edit_file tool for EXISTING files
3. Each tool call will show approval UI to user
4. After approval, file is created on disk

## Example:
User: "Create a chess game"

WRONG Response:
"Here's the code:
````javascript
const board = ...
```"

CORRECT Response:
"I'll create a chess game with 3 files."
[Calls write_file tool for index.html]
[Calls write_file tool for styles.css]
[Calls write_file tool for script.js]

## Tools Available:
- write_file(path, content) - Create new file, shows approval
- edit_file(path, old_text, new_text) - Edit file, shows approval
- read_file(path) - Read file content

ALWAYS use tools for code. NEVER paste code in chat.
```

---

## 🛠️ Extension Side: Show Approval UI

When the LLM calls `write_file`, your extension should:
```typescript
// When agent calls write_file tool
async function handleWriteFileTool(path: string, content: string) {
    // 1. Send to webview to show approval UI
    webview.postMessage({
        type: 'fileApproval',
        action: 'create',
        path: path,
        content: content,
        preview: content.slice(0, 500) // Preview first 500 chars
    });
    
    // 2. Wait for user response
    const approved = await waitForUserApproval();
    
    // 3. If approved, create the file
    if (approved) {
        await vscode.workspace.fs.writeFile(
            vscode.Uri.joinPath(workspaceRoot, path),
            Buffer.from(content)
        );
        return { success: true, message: `Created ${path}` };
    } else {
        return { success: false, message: 'User rejected' };
    }
}
```

---

## 🎨 Approval UI Component (React)
```tsx
function FileApproval({ path, content, onApprove, onReject }) {
    const [showDiff, setShowDiff] = useState(false);
    
    return (
        <div className="file-approval">
            <div className="header">
                <span className="icon">📄</span>
                <span className="action">Creating:</span>
                <span className="path">{path}</span>
            </div>
            
            {showDiff && (
                <pre className="code-preview">
                    <code>{content}</code>
                </pre>
            )}
            
            <div className="actions">
                <button onClick={() => setShowDiff(!showDiff)}>
                    {showDiff ? 'Hide' : 'View'} Code
                </button>
                <button className="approve" onClick={onApprove}>
                    ✓ Approve
                </button>
                <button className="reject" onClick={onReject}>
                    ✗ Reject
                </button>
            </div>
        </div>
    );
}
```

---

## Summary

| Issue | Fix |
|-------|-----|
| Code in chat | Add "NEVER write code in chat, USE TOOLS" to prompt |
| No approval UI | Show UI when tool is called, wait for user |
| No file creation | Create file on disk after approval |

Do you want me to create a complete implementation guide for the approval flow?