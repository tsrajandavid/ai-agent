---
name: performance-optimization
description: Best practices for optimizing application performance
---

# SKILL: PERFORMANCE OPTIMIZATION

When optimizing code or identifying performance issues, follow these guidelines:

## FRONTEND (REACT/WEB)

### Rendering Optimization
- Use `React.memo` for components that re-render often with same props
- Use `useMemo` for expensive calculations (filtering, sorting large lists)
- Use `useCallback` for functions passed as props to memoized components
- Avoid defining components inside other components
- Virtualize long lists (react-window or react-virtualized)

### Bundle Size
- Code split with `React.lazy` and `Suspense` for routes
- Lazy load heavy libraries
- Analyze bundle with `source-map-explorer` or `webpack-bundle-analyzer`
- Tree-shaking: Ensure imports allow for unused code removal

### Assets
- Optimize images (WebP, proper sizing, lazy loading `loading="lazy"`)
- Preload critical fonts
- Use SVGs for icons
- CDN for static assets

## BACKEND (NODE.JS)

### Database
- Use indexes for frequently queried fields
- Avoid N+1 query problems (use `include`, `populate`, or DataLoaders)
- Select only needed fields (projection)
- Use connection pooling
- Cache expensive queries (Redis)

### Runtime
- Offload heavy computation to worker threads or separate services
- Use streams for large file processing
- Avoid blocking the Event Loop
- Use compression (gzip/brotli) for responses

## GENERAL

- **Measure First**: Use Chrome DevTools, Lighthouse, or profiling tools before optimizing. Note the baseline.
- **Critical Path**: Focus on optimizations that improve Largest Contentful Paint (LCP) and Interaction to Next Paint (INP).
- **Caching**: Implement HTTP caching (Cache-Control headers) effectively.
