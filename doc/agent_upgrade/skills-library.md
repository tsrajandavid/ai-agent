# Agent Skills Library
## Add these to your system prompt based on detected project type

---

## Skill: React Development

**Trigger:** `dependencies['react']` exists

```
═══════════════════════════════════════════════════════════════════════════════
SKILL: REACT DEVELOPMENT
═══════════════════════════════════════════════════════════════════════════════

You are working in a React project. Follow these patterns:

COMPONENT CREATION:
• Use functional components with hooks
• Create separate files for component, styles, and tests
• Use proper TypeScript types for props
• Export from index.ts for clean imports

COMPONENT STRUCTURE:
```tsx
// Component.tsx
import { useState, useEffect } from 'react';
import styles from './Component.module.css';

interface ComponentProps {
  // Define all props
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Hooks at top
  const [state, setState] = useState();
  
  // Effects next
  useEffect(() => {}, []);
  
  // Handlers
  const handleClick = () => {};
  
  // Render
  return (
    <div className={styles.container}>
      {/* JSX */}
    </div>
  );
}
```

HOOKS BEST PRACTICES:
• Keep hooks at component top level
• Use dependency arrays correctly
• Create custom hooks for reusable logic
• Cleanup in useEffect return

STATE MANAGEMENT:
• useState for simple local state
• useReducer for complex state logic
• Context for shared state across components
• Consider Zustand/Redux for large apps

PERFORMANCE:
• React.memo for expensive components
• useMemo for expensive calculations
• useCallback for stable function references
• Lazy load routes/components

FILE NAMING:
• Components: PascalCase (Button.tsx)
• Hooks: camelCase with 'use' prefix (useAuth.ts)
• Utils: camelCase (formatDate.ts)
• Styles: Component.module.css or Component.css
```

---

## Skill: Next.js Development

**Trigger:** `dependencies['next']` exists

```
═══════════════════════════════════════════════════════════════════════════════
SKILL: NEXT.JS DEVELOPMENT
═══════════════════════════════════════════════════════════════════════════════

You are working in a Next.js project. Follow these patterns:

APP ROUTER (app/):
• page.tsx - Page component
• layout.tsx - Shared layout
• loading.tsx - Loading UI
• error.tsx - Error boundary
• not-found.tsx - 404 page

SERVER VS CLIENT:
• Default is Server Component
• Add 'use client' for interactivity
• Keep client components small
• Fetch data in Server Components

DATA FETCHING:
```tsx
// Server Component (default)
async function Page() {
  const data = await fetch('...', { cache: 'force-cache' });
  return <div>{data}</div>;
}

// Client Component
'use client'
function Interactive() {
  const [data, setData] = useState();
  // Use SWR or React Query
}
```

API ROUTES (app/api/):
```tsx
// app/api/users/route.ts
export async function GET(request: Request) {
  return Response.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ success: true });
}
```

ROUTING:
• Folder = route segment
• [param] = dynamic segment
• [...slug] = catch-all
• (group) = route group (no URL)

METADATA:
```tsx
export const metadata = {
  title: 'Page Title',
  description: 'Description',
};
```

BEST PRACTICES:
• Prefer Server Components
• Use Suspense for loading states
• Handle errors with error.tsx
• Use next/image for images
• Use next/link for navigation
```

---

## Skill: Node.js/Express Backend

**Trigger:** `dependencies['express']` exists

```
═══════════════════════════════════════════════════════════════════════════════
SKILL: NODE.JS/EXPRESS BACKEND
═══════════════════════════════════════════════════════════════════════════════

You are working in an Express backend project. Follow these patterns:

PROJECT STRUCTURE:
```
src/
  routes/          # Route definitions
  controllers/     # Request handlers
  services/        # Business logic
  models/          # Data models
  middleware/      # Custom middleware
  utils/           # Helpers
  config/          # Configuration
```

ROUTE DEFINITION:
```typescript
// routes/users.ts
import { Router } from 'express';
import { getUsers, createUser } from '../controllers/users';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createUserSchema } from '../schemas/user';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, validate(createUserSchema), createUser);

export default router;
```

CONTROLLER PATTERN:
```typescript
// controllers/users.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';

export async function getUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await UserService.findAll();
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}
```

ERROR HANDLING:
```typescript
// middleware/errorHandler.ts
export function errorHandler(err, req, res, next) {
  console.error(err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    error: message
  });
}
```

SECURITY:
• Use helmet for headers
• Configure CORS properly
• Validate all input (Joi/Zod)
• Sanitize user input
• Use parameterized queries
• Hash passwords (bcrypt)
• Rate limit endpoints

RESPONSE FORMAT:
```json
{
  "success": true,
  "data": { },
  "message": "Optional message"
}

{
  "success": false,
  "error": "Error message"
}
```
```

---

## Skill: TypeScript

**Trigger:** Files ending with `.ts` or `.tsx`

```
═══════════════════════════════════════════════════════════════════════════════
SKILL: TYPESCRIPT
═══════════════════════════════════════════════════════════════════════════════

You are working in a TypeScript project. Follow these patterns:

TYPE DEFINITIONS:
```typescript
// Use interfaces for objects
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// Use type for unions, intersections
type Status = 'pending' | 'active' | 'inactive';
type AdminUser = User & { permissions: string[] };

// Use enums sparingly, prefer union types
type Direction = 'up' | 'down' | 'left' | 'right';
```

FUNCTION TYPES:
```typescript
// Type parameters and return
function getUser(id: string): Promise<User | null> {
  // ...
}

// Arrow functions
const formatName = (user: User): string => {
  return `${user.name}`;
};

// Generic functions
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

REACT + TYPESCRIPT:
```typescript
// Component props
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children: React.ReactNode;
}

// Component
export function Button({ variant, size = 'md', onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}

// Hooks
const [user, setUser] = useState<User | null>(null);
const ref = useRef<HTMLDivElement>(null);
```

AVOID:
• Don't use `any` - use `unknown` if truly unknown
• Don't use `!` (non-null assertion) - handle null properly
• Don't ignore type errors - fix them
• Don't over-type - let inference work

BEST PRACTICES:
• Enable strict mode
• Define types close to usage
• Export types from index files
• Use readonly for immutable data
• Use Partial<T>, Pick<T>, Omit<T> utilities
```

---

## Skill: Tailwind CSS

**Trigger:** `dependencies['tailwindcss']` exists

```
═══════════════════════════════════════════════════════════════════════════════
SKILL: TAILWIND CSS
═══════════════════════════════════════════════════════════════════════════════

You are working with Tailwind CSS. Follow these patterns:

COMMON PATTERNS:

Flexbox Centering:
<div className="flex items-center justify-center">

Grid Layout:
<div className="grid grid-cols-3 gap-4">

Card:
<div className="bg-white rounded-lg shadow-md p-6">

Button:
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">

Input:
<input className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">

RESPONSIVE DESIGN:
• Mobile first (no prefix)
• sm: >= 640px
• md: >= 768px
• lg: >= 1024px
• xl: >= 1280px

<div className="text-sm md:text-base lg:text-lg">

DARK MODE:
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

HOVER/FOCUS/ACTIVE:
<button className="bg-blue-500 hover:bg-blue-600 focus:ring-2 active:bg-blue-700">

GROUP HOVER:
<div className="group">
  <span className="group-hover:text-blue-500">

AVOID:
• Don't use inline styles with Tailwind
• Don't create single-use custom classes
• Keep className readable (extract to components if too long)

ORGANIZATION:
Order classes: layout → sizing → spacing → typography → colors → effects
className="flex items-center w-full p-4 text-lg font-bold text-blue-500 hover:text-blue-600"
```

---

## Skill: Testing (Jest/Vitest)

**Trigger:** `dependencies['jest']` or `dependencies['vitest']` exists

```
═══════════════════════════════════════════════════════════════════════════════
SKILL: TESTING
═══════════════════════════════════════════════════════════════════════════════

You are working with tests. Follow these patterns:

TEST STRUCTURE:
```typescript
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should behavior', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

REACT TESTING:
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

API TESTING:
```typescript
import request from 'supertest';
import app from '../app';

describe('GET /api/users', () => {
  it('should return users list', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

MOCKING:
```typescript
// Mock module
jest.mock('../services/api', () => ({
  fetchUser: jest.fn(),
}));

// Mock implementation
import { fetchUser } from '../services/api';
(fetchUser as jest.Mock).mockResolvedValue({ id: '1', name: 'Test' });
```

BEST PRACTICES:
• Test behavior, not implementation
• Use descriptive test names
• One assertion focus per test
• Don't test external libraries
• Mock external dependencies
• Keep tests fast
```

---

## How to Use Skills

```typescript
// src/skills/index.ts

const SKILLS = {
    react: { trigger: (ctx) => ctx.deps['react'], prompt: REACT_SKILL },
    nextjs: { trigger: (ctx) => ctx.deps['next'], prompt: NEXTJS_SKILL },
    express: { trigger: (ctx) => ctx.deps['express'], prompt: EXPRESS_SKILL },
    typescript: { trigger: (ctx) => ctx.hasTypeScript, prompt: TYPESCRIPT_SKILL },
    tailwind: { trigger: (ctx) => ctx.deps['tailwindcss'], prompt: TAILWIND_SKILL },
    testing: { trigger: (ctx) => ctx.deps['jest'] || ctx.deps['vitest'], prompt: TESTING_SKILL },
};

export function getActiveSkills(context: ProjectContext): string {
    return Object.values(SKILLS)
        .filter(skill => skill.trigger(context))
        .map(skill => skill.prompt)
        .join('\n\n');
}

// Usage in system prompt
const systemPrompt = `
${BASE_PROMPT}

${getActiveSkills(projectContext)}
`;
```
