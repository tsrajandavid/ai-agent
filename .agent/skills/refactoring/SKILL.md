---
name: refactoring
description: Techniques for improving code structure without changing behavior
---

# SKILL: REFACTORING

Apply these principles when cleaning up code:

## PRINCIPLES

- **Behavior Preservation**: The external behavior must NOT change.
- **Small Steps**: Make incremental changes, verifying functionality at each step.
- **Test First**: Ensure tests exist and pass before refactoring.

## TECHNIQUES

### Extraction
- **Extract Method**: Move complex logic block into a helper function with a descriptive name.
- **Extract Component**: Split large React components into smaller sub-components.
- **Extract Constant**: Replace magic numbers/strings with named constants.

### Simplification
- **Early Return**: Reduce nesting by returning early from functions.
- **Rename**: Change variable/function names to reveal compliance with intent.
- **Remove Dead Code**: Delete unused variables, imports, and functions.

### Abstraction
- **Pull Up/Push Down**: Move methods in class inheritance hierarchies.
- **Replace Conditional with Polymorphism**: Use classes/strategies instead of long switch statements.

## CODE SMELLS TO WATCH FOR

- **Long Function**: > 20-30 lines. hard to test/understand.
- **Large Class/Component**: Too many responsibilities (God Object).
- **Duplicate Code**: Don't Repeat Yourself (DRY).
- **Prop Drilling**: Passing data through too many layers (Use Composition or Context).
- **Primitive Obsession**: Using strings/ints instead of specific types/objects.

## REFACTORING WORKFLOW

1. **Audit**: Read code, match smells.
2. **Plan**: Decide which technique applies.
3. **Execute**: Apply change.
4. **Verify**: Run tests/lint.
