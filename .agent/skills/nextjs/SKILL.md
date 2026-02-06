---
name: nextjs
description: Next.js App Router patterns and best practices. Activates when next is in dependencies.
---

# Next.js Skill

## App Router File Conventions
- `page.tsx` — Page component
- `layout.tsx` — Shared layout
- `loading.tsx` — Loading UI (Suspense boundary)
- `error.tsx` — Error boundary
- `not-found.tsx` — 404 page

## Server vs Client Components
- Default is Server Component — no `useState`, `useEffect`, or browser APIs
- Add `'use client'` only for interactivity
- Keep client components small and at the leaf level
- Fetch data in Server Components, pass as props

## API Routes (app/api/)
```typescript
export async function GET(request: Request) {
  return Response.json({ data: [] });
}
```

## Best Practices
- Prefer Server Components for data fetching
- Use Suspense with `loading.tsx` for streaming
- Handle errors with `error.tsx` boundaries
- Use `next/image` for optimized images
- Use `next/link` for client-side navigation
- Co-locate components with their routes when possible
