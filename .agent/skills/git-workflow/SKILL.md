---
name: git-workflow
description: Guides Git operations including commits, branches, merges, and conflict resolution. Use when working with version control, creating branches, or managing code changes.
---

# Git Workflow Skill

This skill helps you work effectively with Git version control.

## Common Git Operations

### 1. **Checking Status & Changes**
- Always run `git status` before committing
- Use `git diff` to review unstaged changes
- Use `git diff --staged` to review staged changes

### 2. **Committing Changes**

**Commit Message Format:**
```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Best Practices:**
- Keep subject line under 50 characters
- Use imperative mood ("Add feature" not "Added feature")
- Separate subject from body with blank line
- Wrap body at 72 characters
- Explain *what* and *why*, not *how*

### 3. **Branch Management**

**Creating Branches:**
```bash
git checkout -b feature/feature-name
git checkout -b fix/bug-description
git checkout -b refactor/component-name
```

**Branch Naming Convention:**
- `feature/` - New features
- `fix/` - Bug fixes
- `hotfix/` - Urgent production fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates

**Switching Branches:**
```bash
git checkout branch-name
git switch branch-name  # Modern alternative
```

### 4. **Merging & Rebasing**

**Safe Merge Process:**
```bash
# 1. Update your branch
git checkout main
git pull origin main

# 2. Merge into feature branch
git checkout feature/your-branch
git merge main

# 3. Resolve conflicts if any
# 4. Test thoroughly
# 5. Merge back to main
git checkout main
git merge feature/your-branch
```

**Rebasing (for clean history):**
```bash
git checkout feature/your-branch
git rebase main
# Resolve conflicts
git rebase --continue
```

### 5. **Conflict Resolution**

**Steps:**
1. Identify conflicted files: `git status`
2. Open files and look for conflict markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Their changes
   >>>>>>> branch-name
   ```
3. Resolve conflicts manually
4. Stage resolved files: `git add <file>`
5. Complete merge: `git commit` or `git rebase --continue`

### 6. **Undoing Changes**

**Unstage files:**
```bash
git reset HEAD <file>
```

**Discard local changes:**
```bash
git checkout -- <file>
git restore <file>  # Modern alternative
```

**Undo last commit (keep changes):**
```bash
git reset --soft HEAD~1
```

**Undo last commit (discard changes):**
```bash
git reset --hard HEAD~1
```

### 7. **Stashing Work**

```bash
# Save work temporarily
git stash

# Save with message
git stash save "WIP: feature description"

# List stashes
git stash list

# Apply most recent stash
git stash apply

# Apply and remove stash
git stash pop

# Apply specific stash
git stash apply stash@{2}
```

## Pre-Commit Checklist

Before committing, ensure:
- [ ] Code compiles/builds successfully
- [ ] Tests pass
- [ ] No debug code or console.logs
- [ ] Code follows project style guide
- [ ] Commit message is clear and descriptive
- [ ] Only related changes are included

## When to Create a Branch

Create a new branch when:
- Starting a new feature
- Fixing a bug
- Experimenting with code
- Working on a long-term change

## Pull Request Best Practices

1. **Keep PRs small and focused**
2. **Write clear PR descriptions**
3. **Link related issues**
4. **Request specific reviewers**
5. **Respond to feedback promptly**
6. **Keep branch up-to-date with main**

## Emergency Commands

**Abort merge:**
```bash
git merge --abort
```

**Abort rebase:**
```bash
git rebase --abort
```

**Recover deleted branch:**
```bash
git reflog
git checkout -b recovered-branch <commit-hash>
```
