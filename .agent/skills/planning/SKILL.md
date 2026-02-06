---
name: planning
description: Strategies for project planning and task decomposition
---

# SKILL: PLANNING & DECOMPOSITION

Before executing complex tasks, apply this thinking process:

## DECOMPOSITION (Break It Down)

1. **Understand Goal**: Rephrase the user request. What is the definition of done?
2. **Identify Components**: What systems/files are touched? (Frontend, Backend, Design, DB)
3. **Sequence**: logic dependencies. "I can't build the UI until the API response shape is known."
4. **Subtasks**: Create granular steps (e.g., "Create file" vs "Build feature").

## ARCHITECTURAL DECISIONS

- **Trade-offs**: Consider Speed vs Quality, Complexity vs Maintainability.
- **Patterns**: Select appropriate patterns (MVC, Observer, Repository) before coding.
- **Constraints**: Respect existing tech stack and conventions.

## RISK ASSESSMENT

- **Unknowns**: What info is missing? (Ask user or investigate first).
- **Side Effects**: Will this break existing functionality?
- **Complexity**: Is there a simpler way? (YAGNI - You Aren't Gonna Need It).

## VERIFICATION STRATEGY

- How will I know it works?
- Manual check? Automated test? Visual inspection?
- Define success criteria upfront.

## PLAN OUTPUT FORMAT

```markdown
## Plan: [Goal Name]

### 1. Analysis
- Verified existing files X, Y.
- Identified need for new component Z.

### 2. Strategy
- EXTEND existing service instead of creating new one.
- USE Context API for state management.

### 3. Execution Steps
1. [ ] Create type definitions
2. [ ] update API service
3. [ ] Build UI component
4. [ ] Integrate and Test
```
