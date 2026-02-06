---
name: debugging-techniques
description: Systematic debugging approaches, tools, and strategies for finding and fixing bugs. Use when troubleshooting issues or investigating unexpected behavior.
---

# Debugging Techniques

## Systematic Debugging Process

### 1. **Reproduce the Bug**
- Create minimal reproduction steps
- Document exact conditions
- Note any error messages
- Check if it's consistent or intermittent

### 2. **Isolate the Problem**
- Binary search: Comment out half the code
- Remove dependencies one by one
- Test in isolation
- Check recent changes

### 3. **Form a Hypothesis**
- What do you expect to happen?
- What actually happens?
- What could cause this difference?

### 4. **Test the Hypothesis**
- Add logging/breakpoints
- Verify assumptions
- Check edge cases

### 5. **Fix and Verify**
- Implement fix
- Test thoroughly
- Ensure no regressions
- Document the solution

## Debugging Tools

### Browser DevTools

**Console:**
```javascript
// Basic logging
console.log('Value:', value);

// Grouped logs
console.group('User Data');
console.log('Name:', user.name);
console.log('Email:', user.email);
console.groupEnd();

// Table view
console.table(arrayOfObjects);

// Timing
console.time('operation');
// ... code ...
console.timeEnd('operation');

// Conditional logging
console.assert(value > 0, 'Value must be positive');
```

**Breakpoints:**
- Line breakpoints: Click line number
- Conditional breakpoints: Right-click → Add conditional breakpoint
- DOM breakpoints: Right-click element → Break on...
- Event listener breakpoints: Sources → Event Listener Breakpoints

**Network Tab:**
- Check request/response
- Verify headers
- Check timing
- Filter by type

### VS Code Debugging

**launch.json for Node.js:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Program",
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    }
  ]
}
```

**Debugging Commands:**
- `F5` - Start debugging
- `F10` - Step over
- `F11` - Step into
- `Shift+F11` - Step out
- `F9` - Toggle breakpoint

## Common Bug Patterns

### 1. **Async Issues**

```typescript
// ❌ Race condition
async function bad() {
  let data;
  fetchData().then(result => data = result);
  return data; // undefined!
}

// ✅ Proper async
async function good() {
  const data = await fetchData();
  return data;
}

// ❌ Missing error handling
async function risky() {
  const data = await fetchData(); // Might throw
  return data;
}

// ✅ With error handling
async function safe() {
  try {
    const data = await fetchData();
    return data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}
```

### 2. **State Management Issues**

```typescript
// ❌ Mutating state
const [items, setItems] = useState([1, 2, 3]);
items.push(4); // Wrong!

// ✅ Immutable update
setItems([...items, 4]);

// ❌ Stale closure
const [count, setCount] = useState(0);
useEffect(() => {
  setInterval(() => {
    setCount(count + 1); // Always uses initial count!
  }, 1000);
}, []);

// ✅ Functional update
useEffect(() => {
  const id = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);
  return () => clearInterval(id);
}, []);
```

### 3. **Memory Leaks**

```typescript
// ❌ Not cleaning up
useEffect(() => {
  const subscription = api.subscribe(data => {
    setData(data);
  });
  // Missing cleanup!
}, []);

// ✅ Proper cleanup
useEffect(() => {
  const subscription = api.subscribe(data => {
    setData(data);
  });
  return () => subscription.unsubscribe();
}, []);

// ❌ Event listener leak
componentDidMount() {
  window.addEventListener('resize', this.handleResize);
}

// ✅ Remove listener
componentWillUnmount() {
  window.removeEventListener('resize', this.handleResize);
}
```

## Debugging Strategies

### 1. **Rubber Duck Debugging**
Explain the problem out loud to someone (or a rubber duck). Often you'll spot the issue while explaining.

### 2. **Binary Search**
Comment out half the code. If bug persists, it's in the other half. Repeat.

### 3. **Add Assertions**
```typescript
function divide(a: number, b: number): number {
  console.assert(b !== 0, 'Division by zero!');
  return a / b;
}
```

### 4. **Trace Execution**
```typescript
function complexFunction(input: any) {
  console.log('1. Input:', input);
  const step1 = transform(input);
  console.log('2. After transform:', step1);
  const step2 = validate(step1);
  console.log('3. After validate:', step2);
  return step2;
}
```

### 5. **Check Assumptions**
```typescript
// Don't assume - verify!
console.log('typeof data:', typeof data);
console.log('Array.isArray(data):', Array.isArray(data));
console.log('data === null:', data === null);
console.log('data === undefined:', data === undefined);
```

## Performance Debugging

### React DevTools Profiler
1. Open React DevTools
2. Go to Profiler tab
3. Click record
4. Perform action
5. Stop recording
6. Analyze flame graph

### Chrome Performance Tab
1. Open DevTools → Performance
2. Click record
3. Perform slow action
4. Stop recording
5. Analyze:
   - Long tasks (yellow)
   - Layout shifts
   - Paint operations

### Memory Profiling
```javascript
// Check memory usage
console.log(performance.memory);

// Take heap snapshot
// DevTools → Memory → Take snapshot
```

## Quick Debugging Checklist

- [ ] Check console for errors
- [ ] Verify network requests
- [ ] Check variable values
- [ ] Confirm function is called
- [ ] Verify correct data types
- [ ] Check for null/undefined
- [ ] Verify async operations complete
- [ ] Check event handlers attached
- [ ] Verify CSS is loaded
- [ ] Check browser compatibility
- [ ] Clear cache and reload
- [ ] Test in incognito mode

## Advanced Techniques

### Source Maps
Enable in production for better stack traces:
```json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

### Error Tracking
```typescript
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', {
    message,
    source,
    lineno,
    colno,
    error
  });
};

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});
```

### Debug Utilities
```typescript
// Deep clone for comparison
const snapshot = JSON.parse(JSON.stringify(obj));

// Freeze object to catch mutations
Object.freeze(obj);

// Stack trace
console.trace('How did we get here?');

// Debugger statement
if (suspiciousCondition) {
  debugger; // Pauses execution
}
```
