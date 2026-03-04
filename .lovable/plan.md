

## Root Cause

The tool is not being called because **the old tool (tool_6801kjvyc047ezsrvx4xm2vkzk1z) still has the old schema** where `question_index` was required. The update flow in both `demo-api-agent-manager` and `agent-manager` has this logic:

```typescript
let toolId = role.tool_save_answer_id;
if (!toolId) {                              // <-- SKIPS if tool already exists
  toolId = await ensureSaveAnswerTool(...);
}
```

Since the role already has `tool_save_answer_id` stored, the code **reuses the old tool ID** without updating its schema. ElevenLabs validates tool parameters before making the webhook call, and since the old tool still requires `question_index` (which the LLM doesn't reliably provide), the call is silently rejected at the platform level — the webhook is never hit, which is why there are zero logs for `elevenlabs-tool-save-answer`.

## Fix

### 1. Always update (PATCH) the existing tool schema when updating an agent

Instead of only creating a tool when none exists, also PATCH the existing tool to update its schema. Add a new `updateSaveAnswerTool()` function that calls `PATCH https://api.elevenlabs.io/v1/convai/tools/{tool_id}` with the current schema.

### 2. Update both agent-manager files

In `supabase/functions/demo-api-agent-manager/index.ts` and `supabase/functions/agent-manager/index.ts`:
- Add `updateSaveAnswerTool(apiKey, toolId)` function
- Change the tool logic from "create only if missing" to "create if missing, PATCH if exists"

```typescript
let toolId = role.tool_save_answer_id;
if (toolId) {
  // Update existing tool schema
  await updateSaveAnswerTool(apiKey, toolId, supabaseUrl);
} else {
  // Create new tool
  toolId = await ensureSaveAnswerTool(apiKey, supabaseUrl);
  if (toolId) {
    await supabase.from('roles').update({ tool_save_answer_id: toolId }).eq('id', roleId);
  }
}
```

### 3. Deploy and re-provision

After deploying the updated edge functions, trigger an agent update (via the Test tab "Update Agent" button) to push the corrected tool schema to ElevenLabs.

## Files to change
- `supabase/functions/demo-api-agent-manager/index.ts` — add `updateSaveAnswerTool`, change tool logic in create/update cases
- `supabase/functions/agent-manager/index.ts` — same changes

