

## Finding

The ElevenLabs PATCH API **rejected** the tool update with this error:

```
"properties": "Input should be a valid dictionary"
"request_headers": "Input should be a valid dictionary"
```

The PATCH endpoint expects **standard JSON Schema format** (object/dict), while our code sends the array format. The tool `tool_6801kjvyc047ezsrvx4xm2vkzk1z` was never updated — it still has the old schema with `question_index` required.

## Fix

Split the schema into two formats:
- **Array format** for `POST /v1/convai/tools` (create) — used by `ensureSaveAnswerTool()`
- **Dict format** for `PATCH /v1/convai/tools/{id}` (update) — used by `updateSaveAnswerTool()`

Additionally, the simplest reliable approach: **delete the old tool and create a fresh one** with the correct schema, then update the agent to reference the new tool ID. This avoids the PATCH format ambiguity entirely.

### Changes

**Both `agent-manager/index.ts` and `demo-api-agent-manager/index.ts`:**

Replace `updateSaveAnswerTool()` to delete the old tool and create a new one:

```typescript
async function updateSaveAnswerTool(apiKey, toolId, supabaseUrl) {
  // Delete old tool
  await fetch(`https://api.elevenlabs.io/v1/convai/tools/${toolId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  });
  // Create fresh tool with correct schema
  return await ensureSaveAnswerTool(apiKey, supabaseUrl);
}
```

Update call sites to capture the new tool ID returned by `updateSaveAnswerTool()` and save it to the database:

```typescript
if (toolId) {
  const newToolId = await updateSaveAnswerTool(apiKey, toolId, supabaseUrl);
  if (newToolId) {
    toolId = newToolId;
    await supabase.from('roles').update({ tool_save_answer_id: toolId }).eq('id', roleId);
  }
} else {
  toolId = await ensureSaveAnswerTool(apiKey, supabaseUrl);
  // ...save toolId
}
```

Keep `getToolSchema()` in the current array format (which works for POST/create).

### Files to change
- `supabase/functions/agent-manager/index.ts` — update `updateSaveAnswerTool` + call sites
- `supabase/functions/demo-api-agent-manager/index.ts` — same

### After deploy
Click "Update Agent" on the role's Test tab to force re-provision with a fresh tool.

