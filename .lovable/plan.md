

## Problem

The screenshot shows the ElevenLabs tool `save_screening_answer` failing with **"Missing required parameter: question_index"**. The LLM correctly extracts `question_text`, `candidate_answer`, and `answer_quality`, but consistently omits `question_index`. This is a known behavior with ElevenLabs conversational AI -- the LLM sometimes fails to populate integer index fields reliably.

## Root Cause

The tool's `request_body_schema` marks `question_index` as **required**, but the ElevenLabs LLM doesn't reliably generate it. Every tool call fails validation before even reaching the webhook endpoint.

## Plan

### 1. Make `question_index` optional in the tool schema (2 files)

In both `supabase/functions/demo-api-agent-manager/index.ts` and `supabase/functions/agent-manager/index.ts`:
- Remove `question_index` from the `required` array
- Keep it in `properties` so the LLM *can* provide it, but won't fail if it doesn't

```
required: ['question_text', 'candidate_answer', 'answer_quality']
```

### 2. Handle missing `question_index` in the webhook (1 file)

In `supabase/functions/elevenlabs-tool-save-answer/index.ts`:
- If `question_index` is missing, derive a key from `question_text` (hash or sequential based on existing answers count)
- Use `Object.keys(existingAnswers).length + 1` as fallback index

```typescript
const effectiveIndex = question_index ?? (Object.keys(existingAnswers).length + 1);
const answerKey = `q_${effectiveIndex}`;
```

### 3. Redeploy both edge functions

After code changes, deploy `demo-api-agent-manager`, `agent-manager`, and `elevenlabs-tool-save-answer`.

### 4. Re-provision the ElevenLabs agent

The tool schema is registered with ElevenLabs when the agent is created/updated. After deploying the updated agent-manager, the agent needs to be re-provisioned (via Settings or by triggering a new screening) so the updated tool schema takes effect.

## Files to change
- `supabase/functions/demo-api-agent-manager/index.ts` -- remove `question_index` from required
- `supabase/functions/agent-manager/index.ts` -- same
- `supabase/functions/elevenlabs-tool-save-answer/index.ts` -- handle missing `question_index` gracefully

