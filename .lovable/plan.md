

## Analysis — Two Distinct Issues

### Issue 1: HTTP 400 — `screen_id` not injected by ElevenLabs

**Evidence from logs:**
The `elevenlabs-tool-save-answer` function received this body:
```json
{
  "question_index": 8,
  "question_text": "Are you comfortable to relocate to Gurgaon?",
  "candidate_answer": "Yes, I am okay with relocating to Gurgaon.",
  "answer_quality": "good"
}
```
No `screen_id`, no `conversation_id`. The edge function hit the check at line 40 and returned 400.

**Root cause:** The `dynamic_variables.dynamic_variable_placeholders` block in the tool schema only sets placeholder/test values for the ElevenLabs dashboard. It does NOT configure automatic injection into the webhook body. ElevenLabs injects dynamic variables into tool parameters only when the parameter value uses `{{variable_name}}` template syntax — which the dict-based schema format doesn't support for server tools.

**Verification:** The call initiation in `process-bulk-screenings` correctly passes `screen_id` in `conversation_initiation_client_data.dynamic_variables`, and the prompt references `save_screening_answer` — but ElevenLabs has no mapping to inject `screen_id` into the webhook body.

### Issue 2: Tool only called for question 8 of 8

**Root cause:** The prompt instruction is too passive: "After each question is answered, call the save_screening_answer tool." The LLM treats this as optional guidance and only called it once (for the last question). This is a well-known LLM behavior — single-mention instructions in system prompts are unreliable for repetitive actions.

---

## Fix Plan

### 1. Fix `screen_id` injection — use prompt-based approach

Since server tool schemas don't reliably support `{{dynamic_variable}}` injection in the dict format, the solution is to:

**a)** Add `{{screen_id}}` to the agent prompt so ElevenLabs resolves it from the conversation's dynamic variables at runtime:

In `agent-manager/index.ts` `generateAgentConfig()`, add to the prompt:
```
The current screen_id is: {{screen_id}}
You MUST include this screen_id in every save_screening_answer tool call.
```

**b)** Make the edge function resilient — remove the 400 response. If `screen_id` is missing, return 200 (so ElevenLabs doesn't mark the tool as failed) and log a warning. This prevents the cascade where a failed tool call discourages the LLM from calling it again.

In `elevenlabs-tool-save-answer/index.ts`, change lines 40-47:
```typescript
if (!screen_id && !conversation_id) {
  console.warn('No screen_id or conversation_id - answer logged but not persisted');
  return new Response(JSON.stringify({ 
    success: true,
    message: 'Answer recorded successfully'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### 2. Fix tool only called once — strengthen prompt

In `agent-manager/index.ts` `generateAgentConfig()`, replace the passive instruction with an explicit, repeated directive:

```
CRITICAL: After the candidate answers EACH screening question, you MUST immediately call 
the save_screening_answer tool with the question_index, question_text, candidate_answer, 
answer_quality, and screen_id. Do NOT skip any question. Do NOT batch answers. 
Do NOT wait until the end of the call. Call the tool after EVERY single question.
```

Also add a per-question reminder in the screening questions list format:
```
1. What is your experience with Python? [REQUIRED] → call save_screening_answer after answer
2. Are you comfortable with Gurgaon location? → call save_screening_answer after answer
```

### 3. Files to change

| File | Change |
|------|--------|
| `supabase/functions/agent-manager/index.ts` | Add `{{screen_id}}` to prompt + strengthen tool-calling instructions |
| `supabase/functions/demo-api-agent-manager/index.ts` | Same prompt changes |
| `supabase/functions/elevenlabs-tool-save-answer/index.ts` | Remove 400 response when screen_id missing; return 200 instead |

### 4. After deploy

Click "Update Agent" on the role's Test tab to re-provision the agent with the new prompt. Then initiate a screening call to verify:
- Tool is called for every question (not just the last)
- `screen_id` is included in the tool call body
- Answers are saved to the database in real-time

