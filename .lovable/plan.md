

## Plan: Fix Scoring, Add Audio Download from ElevenLabs, Remove Redundant UI

### Issues to Fix

1. **Scoring still broken in `refetch-screen-data`**: `scoreFromAnswerQuality` accepts `totalQuestions` param but ignores it (line 92 uses `entries.length`). This is why score is still 100/pass for 1 of 8 questions.

2. **Recording download**: Instead of relying on `recording_url` from webhook metadata (often null), fetch audio directly from `GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio`. The Download Recording button should call a new edge function that proxies this request.

3. **`completed_at` from ElevenLabs**: The ElevenLabs conversation API response contains timestamps in its metadata (e.g., `metadata.start_time_unix_secs` or the last transcript entry's `time_in_call_secs`). The refetch function should extract the actual call end time from ElevenLabs rather than falling back to `new Date()`.

4. **Remove Export JSON/CSV buttons** from individual screen detail page (lines 286-294).

5. **Disable Schedule Follow-up button** (line 395) -- mark as "Coming Soon".

6. **Remove QuickActionsMenu** from AppLayout header -- it's redundant with existing nav items.

### Changes

#### 1. Fix `scoreFromAnswerQuality` in `refetch-screen-data/index.ts` (lines 75-116)

Update the function body to actually use the `totalQuestions` parameter:

```typescript
function scoreFromAnswerQuality(answers, securityFlags?, totalQuestions?) {
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

  // Completeness: not all questions answered → incomplete
  if (totalQuestions && entries.length < totalQuestions) {
    return { score, outcome: 'incomplete', reasons: [`Only ${entries.length} of ${totalQuestions} questions answered`] };
  }

  // Then existing security/threshold logic...
}
```

Also set `updateData.total_questions` and `updateData.questions_answered` in the update block.

#### 2. Extract `completed_at` from ElevenLabs metadata in `refetch-screen-data`

After fetching conversation data, extract the actual end time:
```typescript
// Use ElevenLabs metadata for completed_at
let callEndTime = screen.completed_at;
if (!callEndTime) {
  // Try metadata timestamps
  if (metadata.end_time_unix_secs) {
    callEndTime = new Date(metadata.end_time_unix_secs * 1000).toISOString();
  } else if (metadata.start_time_unix_secs && metadata.duration_seconds) {
    callEndTime = new Date((metadata.start_time_unix_secs + metadata.duration_seconds) * 1000).toISOString();
  } else {
    callEndTime = new Date().toISOString();
  }
}
```

#### 3. New edge function: `supabase/functions/get-conversation-audio/index.ts`

Proxies the ElevenLabs audio API:
- Accepts `{ conversation_id }` 
- Calls `GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio`
- Returns the audio binary to the client

#### 4. Update `src/pages/ScreenDetail.tsx`

- **Remove** Export JSON and Export CSV buttons (lines 286-294)
- **Change** Download Recording button to call the new `get-conversation-audio` edge function using the `session_id` instead of relying on `recording_url`
- **Disable** Schedule Follow-up button, add "(Coming Soon)" text
- **Fix** Created date format: `'PPP'` → `'PPp'` (line 366)

#### 5. Update `src/components/layout/AppLayout.tsx`

- Remove `QuickActionsMenu` import and usage (lines 14, 121)
- Remove the `QuickActionsMenu.tsx` component file (can keep file but remove from layout)

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/refetch-screen-data/index.ts` | Fix `scoreFromAnswerQuality` denominator, extract `completed_at` from ElevenLabs metadata |
| `supabase/functions/get-conversation-audio/index.ts` | New -- proxy ElevenLabs audio API |
| `src/pages/ScreenDetail.tsx` | Remove export buttons, fix recording download, disable follow-up, fix date format |
| `src/components/layout/AppLayout.tsx` | Remove QuickActionsMenu |
| `supabase/config.toml` | Add `get-conversation-audio` function config |

