

## How the Tool Schema Reaches ElevenLabs

The `ensureSaveAnswerTool()` function (line 65 in `agent-manager/index.ts`) calls the **ElevenLabs Tools API** (`POST https://api.elevenlabs.io/v1/convai/tools`) to register the `save_screening_answer` tool. This is where the `request_body_schema` — including the `required` array — lives. The tool is then attached to the agent via `tool_ids` when the agent is created or updated.

**The problem**: `ensureSaveAnswerTool()` creates a **new tool every time** it's called (POST, not PUT). The old agents still reference old tool IDs with the old schema (where `question_index` was required). The code change we made only affects **newly created** tools going forward.

**To fix existing agents**: The agent for this role must be **re-provisioned** — meaning the agent-manager function must run again for this role, which will:
1. Create a new tool with the updated schema (without `question_index` required)
2. Create or update the ElevenLabs agent to reference the new tool ID

## What Needs to Happen

### Already done (code changes)
- `question_index` removed from `required` in the tool schema (both `agent-manager` and `demo-api-agent-manager`)
- `elevenlabs-tool-save-answer` handles missing `question_index` with a fallback

### Still needed: Re-provision the agent

The existing ElevenLabs agent for this role still points to the **old tool** with `question_index` required. You need to trigger agent re-provisioning by one of these methods:

1. **Edit and save the role** in the app (e.g., change a question slightly and save) — this triggers the agent-manager function, which creates a new tool with the updated schema and updates the agent
2. **Manually invoke** the agent-manager edge function for this role's ID

### Plan: Add a "Re-provision Agent" action

To make this easier, add a button on the role detail page that calls the agent-manager function to force-update the ElevenLabs agent with the latest tool schema, without requiring the user to edit the role.

**File to change**: `src/pages/RoleDetail.tsx` — add a "Sync Agent" or "Re-provision Agent" button that invokes the agent-manager edge function for the current role.

### Additional improvement: Add `screen_id` as dynamic variable

Per the earlier plan, `screen_id` should be added to the tool schema and passed via `dynamic_variables` in the outbound call so the webhook knows which screen record to update. Without this, the webhook cannot reliably find the correct database record.

**Files to change**:
- `supabase/functions/agent-manager/index.ts` — add `screen_id` to tool schema properties
- `supabase/functions/demo-api-agent-manager/index.ts` — same
- `supabase/functions/elevenlabs-voice/index.ts` — move `screen_id` into `dynamic_variables`
- `supabase/functions/elevenlabs-tool-save-answer/index.ts` — use `question_text`-based keys to prevent race conditions
- `src/pages/RoleDetail.tsx` — add "Re-provision Agent" button

