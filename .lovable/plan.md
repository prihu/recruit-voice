

## What

Add auto-sync of the ElevenLabs voice agent whenever a role is updated (PUT handler), so changes to questions, JD, FAQ, or evaluation criteria are automatically reflected in the agent's prompt and knowledge base.

## How

Same fire-and-forget pattern as the POST handler, but using `action: 'create'` (which is idempotent — it updates the existing agent if one already exists).

### Changes

**`supabase/functions/api-roles/index.ts`** — PUT handler (after line 141, before the return):
```typescript
// Auto-sync voice agent (fire-and-forget)
try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  await fetch(`${supabaseUrl}/functions/v1/agent-manager`, {
    method: 'POST',
    headers: {
      'Authorization': req.headers.get('Authorization')!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'create', roleId }),
  });
} catch (e) {
  console.error('Auto-sync agent failed (non-blocking):', e);
}
```

**`supabase/functions/demo-api-roles/index.ts`** — PUT handler (after line 216, before the return):
```typescript
// Auto-sync voice agent (fire-and-forget)
try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  await fetch(`${supabaseUrl}/functions/v1/demo-api-agent-manager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', roleId }),
  });
} catch (e) {
  console.error('Auto-sync agent failed (non-blocking):', e);
}
```

### Files to change
- `supabase/functions/api-roles/index.ts`
- `supabase/functions/demo-api-roles/index.ts`

