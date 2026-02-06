---
name: tailwind
description: Tailwind CSS utility patterns and responsive design. Activates when tailwindcss is in dependencies.
---

# Tailwind CSS Skill

## Common Patterns
- Flexbox Centering: `flex items-center justify-center`
- Grid Layout: `grid grid-cols-3 gap-4`
- Card: `bg-white rounded-lg shadow-md p-6`
- Button: `px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600`

## Responsive Design
- Mobile first (no prefix)
- sm: >= 640px
- md: >= 768px
- lg: >= 1024px
- xl: >= 1280px

## Class Organization
Order classes: layout → sizing → spacing → typography → colors → effects

## Best Practices
- Use `@apply` sparingly — prefer utility classes in JSX
- Extract repeated patterns into components, not CSS
- Use arbitrary values `[value]` only when design tokens don't fit
- Prefer `gap` over margins for flex/grid spacing
