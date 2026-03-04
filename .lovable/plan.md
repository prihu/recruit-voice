

## What

Auto-provision the ElevenLabs voice agent whenever a new role is created, so recruiters don't need to manually click "Update Agent."

## How

After a role is successfully inserted (POST handler), call the `agent-manager` (or `demo-api-agent-manager`) edge function's `create` action internally. Since both are Deno edge functions in the same Supabase project, the simplest approach is to make an HTTP call to the agent-manager function from within the roles function.

### Changes

**`supabase/functions/api-roles/index.ts`** — POST handler (lines 94-110):
After the role is inserted and returned, fire-and-forget a call to `agent-manager/create`:

```typescript
case 'POST':
  const body = await req.json()
  const { data, error } = await supabaseClient
    .from('roles')
    .insert({ ...body, organization_id: orgMember.organization_id, user_id: user.id })
    .select()
    .single()

  if (error) throw error

  // Auto-provision voice agent (fire-and-forget)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    await fetch(`${supabaseUrl}/functions/v1/agent-manager/create`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization')!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roleId: data.id }),
    });
  } catch (e) {
    console.error('Auto-provision agent failed (non-blocking):', e);
  }

  return new Response(JSON.stringify(data), { status: 201, ... })
```

**`supabase/functions/demo-api-roles/index.ts`** — POST handler (lines 150-182):
Same pattern, but calling `demo-api-agent-manager/create`:

```typescript
// After role insert succeeds...
try {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  await fetch(`${supabaseUrl}/functions/v1/demo-api-agent-manager/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: role.id }),
  });
} catch (e) {
  console.error('Auto-provision agent failed (non-blocking):', e);
}
```

The demo agent-manager doesn't require auth (it uses service role internally), so no auth header needed. The real `api-roles` forwards the user's auth token.

### Key design decisions
- **Non-blocking**: The agent creation is wrapped in try/catch so a failure doesn't prevent the role from being created. The role is returned to the frontend immediately.
- **No UI changes needed**: The existing agent status indicators on the role detail page will reflect the provisioning state.
- **Idempotent**: If someone later clicks "Update Agent" manually, it still works — it just updates the already-created agent.

### Files to change
- `supabase/functions/api-roles/index.ts`
- `supabase/functions/demo-api-roles/index.ts`

