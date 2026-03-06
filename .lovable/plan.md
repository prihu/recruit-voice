

## Problem
The Screens page only fetches data once on mount. After a bulk screening call completes, the status stays "pending" until the user manually clicks Refresh.

## Fix
Add a 15-second polling interval to `useEffect` in `src/pages/Screens.tsx` that auto-refreshes the list silently (without showing the loading spinner). This is simple, reliable, and avoids the complexity of Realtime subscriptions in demo mode.

**File: `src/pages/Screens.tsx`** — Update the `useEffect` (around lines 108-112):

```typescript
useEffect(() => {
  fetchScreens();

  // Auto-refresh every 15 seconds to pick up status changes
  const interval = setInterval(() => {
    fetchScreens(false);
  }, 15000);

  return () => clearInterval(interval);
}, []);
```

This single change ensures the table updates automatically after calls complete, without requiring manual refresh clicks.

