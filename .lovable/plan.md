

## Fix: Completeness-Based Scoring and Timestamp Display

### Problem 1: Wrong scoring -- divides by answered count, not total questions

`scoreFromAnswerQuality` uses `entries.length` (answered questions only) as denominator. If 1 out of 8 questions is answered with "good" quality, score = 1/1 = 100% → "pass". Should be 1/8 = 12.5% → "incomplete".

**Rule**: If not all questions were answered, outcome = `incomplete`, regardless of answer quality scores.

### Problem 2: "Updated X ago" conflates DB update time with call end time

Line 366 of `ScreenDetail.tsx` shows `updatedAt` (which changes on every refetch/poll). The actual `completed_at` is in the DB but not mapped to the frontend type or displayed. Also, `refetch-screen-data` overwrites `completed_at` with `new Date()` (line 460).

---

### Changes

#### 1. Update `scoreFromAnswerQuality` in all 4 edge functions

Add `totalQuestions` parameter. New logic:

```typescript
function scoreFromAnswerQuality(
  answers: Record<string, any>, 
  securityFlags?: SecurityFlags, 
  totalQuestions?: number
): { score, outcome, reasons } {
  const entries = Object.values(answers);
  if (entries.length === 0) return { score: 0, outcome: 'incomplete', reasons: ['No answers captured'] };

  let sum = 0;
  for (const entry of entries) {
    const quality = (entry?.answer_quality || '').toLowerCase();
    if (quality === 'good') sum += 1.0;
    else if (quality === 'partial') sum += 0.5;
  }

  const denominator = totalQuestions ? Math.max(totalQuestions, entries.length) : entries.length;
  const score = Math.round((sum / denominator) * 100);

  // Completeness check: if not all questions answered → incomplete
  if (totalQuestions && entries.length < totalQuestions) {
    return { score, outcome: 'incomplete', reasons: [`Only ${entries.length} of ${totalQuestions} questions answered`] };
  }

  // Then existing security/threshold logic...
}
```

Each caller needs to fetch `totalQuestions` from the role:
- **webhook**: Already fetches `roles.questions` in PATH A (line 308). Extend to also fetch in PATH B/B.5 using `customData.role_id`.
- **refetch**: Already has `screen.role_id`. Add role fetch before scoring.
- **recover-stuck**: Has `screen.role_id` in select. Add role fetch.
- **poll-stuck**: Has `screen.role_id` in select. Add role fetch.

Also update `total_questions` and `questions_answered` in `updateData` for all paths.

#### 2. Fix `refetch-screen-data` timestamp

Line 460: change `completed_at: new Date().toISOString()` to only set `completed_at` if it doesn't already exist on the screen record. Fetch `completed_at` in the initial screen query and preserve it.

#### 3. Frontend: Show "Call Ended" and "Last Updated" separately

**`src/types/index.ts`**: Add `completedAt?: Date` to `Screen` interface.

**`src/pages/ScreenDetail.tsx`**:
- Map `completed_at` → `completedAt` in the transform (line ~98).
- Replace the single clock line (line 366) with two lines:
  - "Call Ended: {completedAt formatted}" (if exists)
  - "Last Updated: {updatedAt formatted}"

#### 4. Deploy all 4 edge functions

---

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/elevenlabs-webhook/index.ts` | Add `totalQuestions` param to `scoreFromAnswerQuality`, fetch role questions for PATH B/B.5, set `total_questions`/`questions_answered` |
| `supabase/functions/refetch-screen-data/index.ts` | Same scoring fix, preserve `completed_at` |
| `supabase/functions/recover-stuck-screens/index.ts` | Same scoring fix, fetch role questions |
| `supabase/functions/poll-stuck-screens/index.ts` | Same scoring fix, fetch role questions |
| `src/types/index.ts` | Add `completedAt?: Date` to Screen |
| `src/pages/ScreenDetail.tsx` | Map `completed_at`, show "Call Ended" + "Last Updated" separately |

