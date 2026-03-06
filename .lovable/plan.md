

## Fixes for 4 Issues on Screen Detail Page

### Issue 1: Created date missing time
Line 366 uses format `'PPP'` (e.g., "March 6th, 2026") -- missing time. Change to `'PPp'` to include time (e.g., "March 6th, 2026, 2:09 PM").

**File**: `src/pages/ScreenDetail.tsx`, line 366
- Change `safeFormat(screen.createdAt, 'PPP')` → `safeFormat(screen.createdAt, 'PPp')`

### Issue 2: Call Ended time incorrect
DB has `completed_at: 2026-03-06 13:55:27.956+00` (UTC). Displayed as "Mar 6, 2026, 7:25 PM" which is IST (UTC+5:30). The time is actually correct in the user's local timezone. However, the user may be saying it's wrong because the call ended earlier than 7:25 PM IST. This timestamp was set by `refetch-screen-data` when the user clicked "Re-fetch" (not the actual call end from ElevenLabs). The `completed_at` was likely overwritten during a refetch before the preservation fix was deployed.

**No code fix needed** -- the preservation logic (`screen.completed_at || new Date()`) is already in place at line 467. The existing data just has the wrong value. We could re-fetch to correct it, but since the original call end time from ElevenLabs metadata may also not have been captured, the best we can do is note this.

### Issue 3: Download Recording greyed out
`recording_url` is `null` in DB. The button is correctly disabled when no URL exists (line 399). ElevenLabs didn't return a `recording_url` in the webhook or conversation API response. This is expected for many ElevenLabs conversations -- **recording must be explicitly enabled in the ElevenLabs agent configuration**. 

**Fix**: Instead of a greyed-out button with no explanation, show a tooltip or text explaining why it's unavailable.

**File**: `src/pages/ScreenDetail.tsx`, lines 396-408
- Add tooltip: "Recording not available - enable recording in ElevenLabs agent settings"

### Issue 4: Score 100 / Outcome Pass -- the `scoreFromAnswerQuality` fix didn't land in refetch-screen-data

**Root cause**: `refetch-screen-data` line 75-116 -- the function signature accepts `totalQuestions` but the body at line 92 still uses `entries.length` as denominator. The completeness check was never added. The caller at line 450 passes `totalQuestions` but it's ignored.

**Fix in `supabase/functions/refetch-screen-data/index.ts`**, lines 80-115:
```typescript
const denominator = totalQuestions ? Math.max(totalQuestions, entries.length) : entries.length;
const score = Math.round((sum / denominator) * 100);

// Completeness: if not all questions answered → incomplete
if (totalQuestions && entries.length < totalQuestions) {
  reasons.push(`Only ${entries.length} of ${totalQuestions} questions answered`);
  return { score, outcome: 'incomplete', reasons };
}
```

Also set `total_questions` in updateData (line 464-476 area):
```typescript
updateData.total_questions = totalQuestions || 0;
```

### Regarding "Schedule Follow-up" button (Question 3)
This is currently a **placeholder button** with no functionality. It's meant for scheduling a retry call to the candidate (e.g., if the screening was incomplete). It does nothing right now. We should either remove it or mark it as "Coming Soon".

**Fix**: Add `disabled` and a "(Coming Soon)" label to avoid confusion.

---

### Summary of changes

| File | Change |
|------|--------|
| `src/pages/ScreenDetail.tsx` | Created date format `PPP` → `PPp`; tooltip on disabled recording button; "Coming Soon" on Schedule Follow-up |
| `supabase/functions/refetch-screen-data/index.ts` | Fix `scoreFromAnswerQuality` to use `totalQuestions` denominator + completeness check; set `total_questions` in updateData |

After deploying the refetch fix, the user should click "Re-fetch from ElevenLabs" on this screen to recalculate the score correctly.

