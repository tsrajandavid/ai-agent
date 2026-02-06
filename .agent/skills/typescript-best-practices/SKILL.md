---
name: typescript-best-practices
description: Provides TypeScript coding standards, type safety patterns, and best practices. Use when writing or reviewing TypeScript code.
---

# TypeScript Best Practices

## Type Safety Principles

### 1. **Prefer Explicit Types Over `any`**

❌ **Avoid:**
```typescript
function process(data: any) {
  return data.value;
}
```

✅ **Prefer:**
```typescript
interface Data {
  value: string;
}

function process(data: Data): string {
  return data.value;
}
```

### 2. **Use Union Types Instead of Optional Properties When Appropriate**

```typescript
// Good for state machines
type LoadingState = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: string }
  | { status: 'error'; error: Error };
```

### 3. **Leverage Type Guards**

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function process(value: unknown) {
  if (isString(value)) {
    // TypeScript knows value is string here
    console.log(value.toUpperCase());
  }
}
```

## Interface vs Type

**Use `interface` for:**
- Object shapes
- Classes
- When you need declaration merging

**Use `type` for:**
- Unions and intersections
- Mapped types
- Tuples
- Function types

```typescript
// Interface
interface User {
  id: string;
  name: string;
}

// Type
type Status = 'active' | 'inactive' | 'pending';
type Point = [number, number];
```

## Utility Types

### Common Built-in Utilities

```typescript
// Partial - Make all properties optional
type PartialUser = Partial<User>;

// Required - Make all properties required
type RequiredUser = Required<User>;

// Pick - Select specific properties
type UserPreview = Pick<User, 'id' | 'name'>;

// Omit - Exclude specific properties
type UserWithoutId = Omit<User, 'id'>;

// Record - Create object type with specific keys
type UserRoles = Record<string, 'admin' | 'user'>;

// ReturnType - Extract return type of function
type Result = ReturnType<typeof myFunction>;
```

## Generic Patterns

### 1. **Generic Functions**

```typescript
function identity<T>(value: T): T {
  return value;
}

function mapArray<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn);
}
```

### 2. **Generic Constraints**

```typescript
interface HasId {
  id: string;
}

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

## Async/Promise Patterns

```typescript
// Properly type async functions
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// Handle errors with proper typing
async function safeRequest<T>(
  fn: () => Promise<T>
): Promise<{ data?: T; error?: Error }> {
  try {
    const data = await fn();
    return { data };
  } catch (error) {
    return { error: error as Error };
  }
}
```

## React + TypeScript

### Component Props

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false 
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

### Hooks

```typescript
// useState with explicit type
const [user, setUser] = useState<User | null>(null);

// Custom hook with proper typing
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
```

## Error Handling

```typescript
// Custom error types
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Type-safe error handling
function handleError(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation failed for ${error.field}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unknown error occurred';
}
```

## Strict Configuration

Enable these in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## Common Pitfalls to Avoid

1. **Don't use `Function` type** - Use specific function signatures
2. **Avoid type assertions (`as`)** - Use type guards instead
3. **Don't ignore TypeScript errors** - Fix them properly
4. **Avoid empty interfaces** - Use `Record<string, never>` or `object`
5. **Don't use `{}` as a type** - Use `Record<string, unknown>` or specific interface
