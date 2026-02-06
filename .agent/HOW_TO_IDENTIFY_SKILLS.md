# How to Identify When Skills Are Being Used

## 🎯 Quick Answer

Your agent now **automatically loads and uses** skills from `.agent/skills/` folder. Here's how to see them in action:

## 📊 Console Logs (Developer Console)

When you reload the extension, you'll see these logs:

```
[Skills] ✓ Loaded skill: git-workflow
[Skills] ✓ Loaded skill: typescript-best-practices
[Skills] ✓ Loaded skill: react-patterns
[Skills] ✓ Loaded skill: debugging-techniques
[Skills] ✓ Loaded skill: api-design
[Skills] ✓ Loaded skill: code-review
[Skills] Loaded 6 skills total
```

When you send a message, you'll see:

```
[Skills] 🎯 Active skills: git-workflow, typescript-best-practices, debugging-techniques, code-review
[System Prompt] 📚 Including 4 skills in prompt
```

## 🔍 How to View Console Logs

### Option 1: Extension Development Host
1. Press `F5` to start debugging
2. In the new VS Code window, open **Help → Toggle Developer Tools**
3. Go to **Console** tab
4. Look for `[Skills]` and `[System Prompt]` logs

### Option 2: Output Panel
The logs also appear in VS Code's Output panel:
1. View → Output
2. Select "AI Agent" from dropdown

## 📋 Which Skills Are Active?

Skills activate based on your project:

| Skill | Activates When |
|-------|---------------|
| `typescript-best-practices` | Project has `.ts` or `.tsx` files |
| `react-patterns` | `react` in dependencies |
| `git-workflow` | Always (for git operations) |
| `debugging-techniques` | Always |
| `api-design` | `express` in dependencies |
| `code-review` | Always |

## 🎨 See Skills in Action

### Example 1: Git Operations
**You ask:** "Commit these changes"

**Console shows:**
```
[Skills] 🎯 Active skills: git-workflow, typescript-best-practices
[System Prompt] 📚 Including 2 skills in prompt
```

**Agent knows:**
- Commit message format (from git-workflow skill)
- Pre-commit checklist
- Branch naming conventions

### Example 2: TypeScript Code
**You ask:** "Add type safety to this function"

**Console shows:**
```
[Skills] 🎯 Active skills: typescript-best-practices, react-patterns
[System Prompt] 📚 Including 2 skills in prompt
```

**Agent knows:**
- Type vs Interface usage
- Generic patterns
- Utility types
- React + TypeScript patterns

### Example 3: Debugging
**You ask:** "Why isn't this working?"

**Console shows:**
```
[Skills] 🎯 Active skills: debugging-techniques, typescript-best-practices
[System Prompt] 📚 Including 2 skills in prompt
```

**Agent knows:**
- Systematic debugging process
- Common bug patterns
- Browser DevTools usage
- Debugging strategies

## 🛠️ Customizing Skill Activation

Edit `src/agent/skill-loader.ts` → `shouldActivateSkill()` method:

```typescript
private shouldActivateSkill(skill: Skill, context: SkillContext): boolean {
    const name = skill.metadata.name.toLowerCase();

    // Add your own rules
    if (name.includes('my-custom-skill') && context.files.some(f => f.includes('special'))) {
        return true;
    }

    // Default behavior
    return true; // Activate all skills
}
```

## 📝 Creating New Skills

1. Create folder: `.agent/skills/my-new-skill/`
2. Create file: `SKILL.md`
3. Add frontmatter:
```markdown
---
name: my-new-skill
description: What this skill does and when to use it
---

# My New Skill

Your skill content here...
```

4. Reload extension - skill loads automatically!

## 🔄 Reload Skills Without Restarting

Currently, skills load once at startup. To reload:
1. Reload VS Code window (`Ctrl+R` or `Cmd+R`)
2. Or restart the extension

## 🐛 Troubleshooting

### Skills Not Loading?

Check console for errors:
```
[Skills] No .agent/skills directory found
[Skills] Failed to load /path/to/SKILL.md: <error>
```

### Skills Not Activating?

Check activation rules in console:
```
[Skills] Loaded 6 skills total
[Skills] 🎯 Active skills: (none shown = none activated)
```

### No Console Logs?

Make sure you're looking at the **Extension Host** console, not the webview console.

## 📚 Current Skills

You have these skills ready to use:

1. **git-workflow** - Git operations, commits, branches
2. **typescript-best-practices** - Type safety, generics, utilities
3. **react-patterns** - Hooks, performance, state management
4. **debugging-techniques** - Systematic debugging, tools
5. **api-design** - RESTful APIs, best practices
6. **code-review** - Code review checklist (from existing)

## 🎯 Next Steps

1. **Test it**: Ask the agent to help with git, TypeScript, or React
2. **Watch logs**: See which skills activate
3. **Create custom skills**: Add your own domain knowledge
4. **Refine activation**: Adjust when skills should activate

---

**Pro Tip**: The more specific your skill descriptions, the better the agent knows when to use them!
