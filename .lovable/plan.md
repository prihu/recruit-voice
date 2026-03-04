

## Root Cause

The tool schema format sent by `getToolSchema()` uses **standard JSON Schema** format:
```json
{
  "properties": {
    "screen_id": { "type": "string", "description": "..." },
    "question_text": { "type": "string", "description": "..." }
  },
  "required": ["question_text", "candidate_answer", "answer_quality"]
}
```

But ElevenLabs uses a **custom array format** (confirmed by the uploaded `save_screening_answer.json`):
```json
{
  "properties": [
    {
      "id": "screen_id",
      "type": "string",
      "value_type": "dynamic_variable",
      "dynamic_variable": "screen_id",
      "description": "...",
      "required": false
    },
    {
      "id": "question_text",
      "type": "string",
      "value_type": "llm_prompt",
      "description": "...",
      "required": true
    }
  ]
}
```

Key differences:
- `properties` is an **array** not an object
- Each property has `id` (name), `value_type` (`llm_prompt` or `dynamic_variable`), and per-property `required`
- `screen_id` must use `value_type: "dynamic_variable"` with `dynamic_variable: "screen_id"` so ElevenLabs auto-injects it from `conversation_initiation_client_data.dynamic_variables`
- There is no top-level `required` array

This means every PATCH and POST we've done either silently failed or created a broken tool config. The existing tool (tool_6801kjvyc047ezsrvx4xm2vkzk1z) still has the original schema with `question_index: required: true`, causing ElevenLabs to reject every tool call before it reaches the webhook.

Additionally, `process-bulk-screenings` passes `screen_id` in `custom_data` but NOT in `dynamic_variables`, so even with the correct schema, the tool wouldn't receive `screen_id`.

## Plan

### 1. Fix tool schema format in both agent-manager files

In `supabase/functions/agent-manager/index.ts` and `supabase/functions/demo-api-agent-manager/index.ts`, rewrite `getToolSchema()` to use ElevenLabs' native format:

```typescript
function getToolSchema(supabaseUrl: string) {
  return {
    name: 'save_screening_answer',
    description: 'Save the candidate\'s answer to a screening question. Call this after each screening question is answered.',
    type: 'webhook',
    api_schema: {
      url: `${supabaseUrl}/functions/v1/elevenlabs-tool-save-answer`,
      method: 'POST',
      request_headers: [],
      request_body_schema: {
        type: 'object',
        properties: [
          {
            id: 'screen_id',
            type: 'string',
            value_type: 'dynamic_variable',
            dynamic_variable: 'screen_id',
            description: 'The screening session ID (auto-populated)',
            required: false,
          },
          {
            id: 'question_index',
            type: 'number',
            value_type: 'llm_prompt',
            description: 'The 1-based index of the screening question',
            required: false,
          },
          {
            id: 'question_text',
            type: 'string',
            value_type: 'llm_prompt',
            description: 'The screening question that was asked',
            required: true,
          },
          {
            id: 'candidate_answer',
            type: 'string',
            value_type: 'llm_prompt',
            description: 'The candidate\'s answer summarized clearly',
            required: true,
          },
          {
            id: 'answer_quality',
            type: 'string',
            value_type: 'llm_prompt',
            description: 'Quality assessment of the answer',
            enum: ['good', 'partial', 'poor', 'skipped'],
            required: true,
          },
        ],
      },
    },
    dynamic_variables: {
      dynamic_variable_placeholders: {
        screen_id: 'placeholder_screen_id',
      },
    },
  };
}
```

### 2. Add `screen_id` to `dynamic_variables` in bulk call initiation

In `supabase/functions/process-bulk-screenings/index.ts`, add `screen_id` to the `dynamic_variables` object (currently only `candidate_name`, `role_title`, `location` are passed):

```typescript
dynamic_variables: {
  candidate_name: candidate.name,
  role_title: role.title,
  location: role.location,
  screen_id: screen.id,  // <-- add this
}
```

### 3. Deploy and re-provision

After deploying, click "Update Agent" on the role's Test tab. This will PATCH the existing tool with the corrected schema format and update the agent.

## Files to change

- `supabase/functions/agent-manager/index.ts` — fix `getToolSchema()` format
- `supabase/functions/demo-api-agent-manager/index.ts` — same
- `supabase/functions/process-bulk-screenings/index.ts` — add `screen_id` to `dynamic_variables`

