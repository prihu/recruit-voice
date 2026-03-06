

## Problem

In `BulkScreeningModal.tsx` line 71, the `activeStatuses` array includes `'completed'`:

```typescript
const activeStatuses = ['pending', 'in_progress', 'scheduled', 'completed'];
```

A `completed` screen means the call is done — it's not active. Including it causes candidates like Priyank Garg (who has a completed screen) to show the "Active screen" badge incorrectly.

## Fix

**File: `src/components/BulkScreeningModal.tsx`** (line 71)

Remove `'completed'` from the active statuses array:

```typescript
const activeStatuses = ['pending', 'in_progress', 'scheduled'];
```

This way only screens that are truly in-flight will trigger the warning badge. Completed, failed, and other terminal states will be ignored.

