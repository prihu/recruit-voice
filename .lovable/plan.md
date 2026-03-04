

## Analysis

From the edge function logs:

```
Failed to create tool: {"detail":[
  {"loc":["body","tool_config","webhook","api_schema","request_headers"],
   "msg":"Input should be a valid dictionary","input":[]},
  {"loc":["body","tool_config","webhook","api_schema","request_body_schema","properties"],
   "msg":"Input should be a valid dictionary","input":[...array...]}
]}
```

```
Deleted old tool tool_6801kjvyc047ezsrvx4xm2vkzk1z: 409
```

**Root cause**: The ElevenLabs `/v1/convai/tools` endpoint (both POST and PATCH) expects standard JSON Schema format — `properties` as a **dict/object** and `request_headers` as a **dict/object**. The array format we used does not work for either endpoint. Additionally, the tool can't be deleted (409) while still referenced by an agent.

## Fix

### 1. Rewrite `getToolSchema()` to use standard JSON Schema dict format

```typescript
function getToolSchema(supabaseUrl: string) {
  const toolUrl = `${supabaseUrl}/functions/v1/elevenlabs-tool-save-answer`;
  return {
    name: 'save_screening_answer',
    description: 'Save the candidate\'s answer to a screening question. Call this after each screening question is answered.',
    type: 'webhook',
    api_schema: {
      url: toolUrl,
      method: 'POST',
      request_headers: {},          // <-- dict, not array
      request_body_schema: {
        type: 'object',
        properties: {               // <-- dict, not array
          screen_id: {
            type: 'string',
            description: 'The screening session ID (auto-populated)',
          },
          question_index: {
            type: 'number',
            description: 'The 1-based index of the screening question',
          },
          question_text: {
            type: 'string',
            description: 'The screening question that was asked',
          },
          candidate_answer: {
            type: 'string',
            description: 'The candidate\'s answer summarized clearly',
          },
          answer_quality: {
            type: 'string',
            description: 'Quality assessment: good, partial, poor, or skipped',
            enum: ['good', 'partial', 'poor', 'skipped'],
          },
        },
        required: ['question_text', 'candidate_answer', 'answer_quality'],
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

### 2. Fix delete-then-create strategy for 409 conflict

Since the tool can't be deleted while referenced by an agent, change the approach: **create a new tool first, then update the agent to point to the new tool**. Don't try to delete the old tool (it will eventually be orphaned).

```typescript
async function updateSaveAnswerTool(apiKey, toolId, supabaseUrl) {
  // Don't delete — 409 if still referenced by agent.
  // Just create a new tool with the correct schema.
  return await ensureSaveAnswerTool(apiKey, supabaseUrl);
}
```

### 3. Files to change
- `supabase/functions/agent-manager/index.ts` — fix `getToolSchema()` format + update strategy
- `supabase/functions/demo-api-agent-manager/index.ts` — same changes

### After deploy
Click "Update Agent" on the role's Test tab. This will create a fresh tool with the correct dict-based schema, update the role's `tool_save_answer_id`, and PATCH the agent to reference the new tool.

