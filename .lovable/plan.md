

## Plan: Graceful 404 handling for Download Recording

The edge function currently returns a generic `502` with `{"error":"ElevenLabs API error: 404"}` when the recording doesn't exist. The client-side already partially handles this but it's fragile (string matching).

### Changes

**1. `supabase/functions/get-conversation-audio/index.ts`** — Return a proper 404 with a clear JSON body when ElevenLabs returns 404, instead of a generic 502:

```typescript
if (response.status === 404) {
  return new Response(
    JSON.stringify({ error: 'recording_not_found', message: 'No audio recording found for this conversation.' }),
    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**2. `src/pages/ScreenDetail.tsx`** — Simplify the client-side check to handle `404` directly alongside the existing `502` check:

```typescript
if (!resp.ok) {
  if (resp.status === 404 || (resp.status === 502 && (await resp.clone().text()).includes('404'))) {
    toast({ title: "Recording Not Available", description: "No audio recording found. It may not have been enabled or has expired.", variant: "destructive" });
    return;
  }
  throw new Error(`HTTP ${resp.status}`);
}
```

| File | Change |
|------|--------|
| `supabase/functions/get-conversation-audio/index.ts` | Return 404 status (not 502) when ElevenLabs says not found |
| `src/pages/ScreenDetail.tsx` | Handle direct 404 response cleanly |

