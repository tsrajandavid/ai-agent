---
name: documentation
description: Best practices for writing code documentation and technical guides
---

# SKILL: DOCUMENTATION

Good documentation is as important as the code itself.

## TYPES OF DOCUMENTATION

### 1. Code Comments
- **Why, not What**: Explain *why* a complex decision was made, not *what* the syntax does (the code shows that).
- **Hack/Fix**: Tag workarounds with `// FIXME` or `// HACK` and explain why.
- **JSDoc/TSDoc**: Document public API functions (params, return types, throws).

### 2. READMEs
- **Project Overview**: What does this project do?
- **Quick Start**: How to install and run immediately.
- **Architecture**: Brief explanation of structure.
- **Contribution**: How to develop/test.

### 3. Architecture Decision Records (ADR)
- **Context**: problem being solved.
- **Decision**: What we chose.
- **Consequences**: Pros/cons of the decision.

### 4. Commit Messages
- **Header**: Imperative, 50 chars max (`feat: add user login`).
- **Body**: Context, "why" (optional).
- **Footer**: Breaking changes, ticket references.

## PRINCIPLES

- **Update with Code**: Documentation rots if not updated with the code it describes.
- **Examples**: Show, don't just tell. Usage examples are critical.
- **Audience**: Write for the reader (Junior Dev, User, or Ops).

## TEMPLATES

### Function Documentation
```typescript
/**
 * Calculates total price with tax.
 * 
 * @param amount - The base price in cents
 * @param taxRate - Decimal tax rate (e.g. 0.2 for 20%)
 * @returns Total price in cents
 * @throws {ValidationError} If inputs are negative
 */
```

### Component Documentation
```tsx
/**
 * Primary UI button for user actions.
 * 
 * @example
 * <Button variant="primary" onClick={doAction}>Save</Button>
 */
```
