---
name: react-patterns
description: Modern React patterns including hooks, performance optimization, and component design. Use when building or refactoring React applications.
---

# React Patterns & Best Practices

## Component Design Patterns

### 1. **Compound Components**

```typescript
// Parent component manages state
const Tabs = ({ children }: { children: React.ReactNode }) => {
  const [activeTab, setActiveTab] = useState(0);
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
};

// Child components access shared state
Tabs.List = ({ children }: { children: React.ReactNode }) => (
  <div className="tab-list">{children}</div>
);

Tabs.Tab = ({ index, children }: { index: number; children: React.ReactNode }) => {
  const { activeTab, setActiveTab } = useTabsContext();
  return (
    <button onClick={() => setActiveTab(index)}>
      {children}
    </button>
  );
};

// Usage
<Tabs>
  <Tabs.List>
    <Tabs.Tab index={0}>Tab 1</Tabs.Tab>
    <Tabs.Tab index={1}>Tab 2</Tabs.Tab>
  </Tabs.List>
</Tabs>
```

### 2. **Render Props Pattern**

```typescript
interface MouseTrackerProps {
  render: (position: { x: number; y: number }) => React.ReactNode;
}

const MouseTracker: React.FC<MouseTrackerProps> = ({ render }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return <>{render(position)}</>;
};

// Usage
<MouseTracker render={({ x, y }) => <div>Mouse at {x}, {y}</div>} />
```

### 3. **Custom Hooks for Logic Reuse**

```typescript
// Data fetching hook
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const response = await fetch(url);
        const json = await response.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// Form handling hook
function useForm<T>(initialValues: T) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const handleChange = (name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const reset = () => setValues(initialValues);

  return { values, errors, handleChange, reset, setErrors };
}
```

## Performance Optimization

### 1. **Memoization**

```typescript
// useMemo - Expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// useCallback - Stable function references
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// React.memo - Component memoization
const MemoizedComponent = React.memo(({ data }: Props) => {
  return <div>{data}</div>;
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.data.id === nextProps.data.id;
});
```

### 2. **Code Splitting**

```typescript
// Lazy loading components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyComponent />
    </Suspense>
  );
}

// Route-based splitting
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard'))
  },
  {
    path: '/settings',
    component: lazy(() => import('./pages/Settings'))
  }
];
```

### 3. **Virtualization for Long Lists**

```typescript
import { FixedSizeList } from 'react-window';

const VirtualList = ({ items }: { items: string[] }) => (
  <FixedSizeList
    height={600}
    itemCount={items.length}
    itemSize={50}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>{items[index]}</div>
    )}
  </FixedSizeList>
);
```

## State Management Patterns

### 1. **useReducer for Complex State**

```typescript
type State = {
  count: number;
  user: User | null;
  loading: boolean;
};

type Action =
  | { type: 'INCREMENT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_LOADING'; payload: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

function Component() {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return (
    <button onClick={() => dispatch({ type: 'INCREMENT' })}>
      Count: {state.count}
    </button>
  );
}
```

### 2. **Context + Reducer Pattern**

```typescript
const AppContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
```

## Error Boundaries

```typescript
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<ErrorMessage />}>
  <App />
</ErrorBoundary>
```

## Best Practices

### ✅ Do's

1. **Keep components small and focused**
2. **Extract reusable logic into custom hooks**
3. **Use TypeScript for type safety**
4. **Memoize expensive computations**
5. **Handle loading and error states**
6. **Clean up effects properly**
7. **Use semantic HTML**
8. **Test components thoroughly**

### ❌ Don'ts

1. **Don't mutate state directly**
2. **Don't use index as key in lists**
3. **Don't forget dependency arrays in hooks**
4. **Don't create components inside components**
5. **Don't use inline object/array literals in JSX**
6. **Don't ignore console warnings**
7. **Don't over-optimize prematurely**

## Testing Patterns

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```
