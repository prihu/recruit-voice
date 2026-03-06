

## Three Issues to Fix

### Issue 1: "Call Ended" time still wrong
**Root cause**: Line 472 in `refetch-screen-data` has `if (!callEndTime)` -- it preserves the OLD wrong `completed_at` value that was set during a previous refetch (before the fix was deployed). On refetch, we should ALWAYS overwrite `completed_at` from ElevenLabs metadata, not preserve stale data.

**Fix**: Remove the `if (!callEndTime)` guard. Always extract from ElevenLabs metadata when refetching.

### Issue 2: Status still shows "Completed"
**Root cause**: Line 497 in `refetch-screen-data` hardcodes `status: 'completed'`. The `outcome` field correctly shows `incomplete` (logs confirm: "score: 13, outcome: incomplete"), but `status` stays `completed`. When outcome is `incomplete`, status should also reflect that.

**Fix**: Set `status` based on outcome:
```
if outcome == 'incomplete' → status = 'incomplete'  
else → status = 'completed'
```

### Issue 3: Downloaded recording not playable
**Root cause**: ElevenLabs returns `application/octet-stream` binary data. `supabase.functions.invoke()` internally parses the response, likely corrupting the binary audio. The client code at line 401 does `new Blob([data])` but `data` may already be mangled by the SDK's response parsing.

**Fix**: Use raw `fetch()` with the full Supabase function URL instead of `supabase.functions.invoke()`, so we get the raw binary response directly as an ArrayBuffer.

---

### Changes

| File | Change |
|------|--------|
| `supabase/functions/refetch-screen-data/index.ts` | Always overwrite `completed_at` from ElevenLabs metadata (remove `if (!callEndTime)` guard); set `status` based on `outcome` |
| `src/pages/ScreenDetail.tsx` | Use raw `fetch()` for audio download instead of `supabase.functions.invoke()` |

