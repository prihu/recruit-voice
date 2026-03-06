

## Problem

Two places filter for "active" screens — the client-side `BulkScreeningModal.tsx` (already fixed) and the server-side `demo-api-bulk-screenings/index.ts` (line 376). The server still includes `'completed'` in its active statuses:

```typescript
.in('status', ['pending', 'in_progress', 'scheduled', 'completed']);
```

This causes Priyank to be skipped server-side with the log message "Skipping 1 candidates with existing active screens", even though his screen is finished.

## Fix

**File: `supabase/functions/demo-api-bulk-screenings/index.ts`** (line 376)

Remove `'completed'` from the status filter:

```typescript
.in('status', ['pending', 'in_progress', 'scheduled']);
```

This single-line change aligns the server with the client fix, allowing candidates with only completed screens to be re-screened.

