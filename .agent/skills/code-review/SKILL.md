---
name: code-review
description: Reviews code for correctness, security, performance, and best practices. Always active as a meta-skill.
---

# Code Review Skill

When reviewing code, follow this systematic checklist:

## Review Checklist

1. **Correctness**: Does the code do what it's supposed to?
2. **Edge cases**: Are null, empty, boundary conditions handled?
3. **Security**: No SQL injection, XSS, command injection, exposed secrets?
4. **Performance**: No unnecessary re-renders, N+1 queries, memory leaks?
5. **DRY**: Is there duplicated logic that should be extracted?
6. **Readability**: Clear naming, reasonable function length, logical structure?
7. **Error handling**: Are errors caught, logged, and handled gracefully?
8. **Types**: Proper TypeScript types (no `any` unless justified)?

## How to Provide Feedback

- Be specific about what needs to change and where
- Explain **why**, not just what
- Suggest concrete alternatives when possible
- Prioritize: blockers > improvements > nits
- Acknowledge good patterns when you see them
