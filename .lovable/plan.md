

## Yes — We Can Re-fetch from ElevenLabs API

The `recover-stuck-screens` function already calls `GET https://api.elevenlabs.io/v1/convai/conversations/{session_id}` to fetch transcript, analysis, and metadata. The problem is it only targets screens with `status = 'in_progress'`. Screen `33d2b434` is already `completed` (with null answers).

## Plan: Create a `refetch-screen-data` Edge Function

A small edge function that takes a `screen_id`, fetches the conversation data from ElevenLabs, and re-runs the updated scoring logic (which now preserves save-answer data).

### New file: `supabase/functions/refetch-screen-data/index.ts`

1. Accept `{ screen_id }` in the request body
2. Fetch the screen record (including `session_id`, `answers`, `role_id`)
3. Call ElevenLabs API: `GET /v1/convai/conversations/{session_id}`
4. Run the same processing as the updated webhook:
   - Extract transcript, duration, recording_url, ai_summary
   - Check for evaluation_criteria_results
   - If no eval criteria, check existing `answers` from DB — but since answers are NULL for this screen, also check the ElevenLabs conversation's `collected_tool_results` (the save-answer tool calls are logged there by ElevenLabs)
   - Score using `answer_quality` and set outcome
   - Update the screen record

### Edit: `src/pages/ScreenDetail.tsx`

- Add a "Re-fetch from ElevenLabs" button (visible when `session_id` exists)
- Calls `supabase.functions.invoke('refetch-screen-data', { body: { screen_id } })`
- Refreshes screen data on success

### Key insight: ElevenLabs stores tool call results

The ElevenLabs conversation GET endpoint returns `collected_tool_results` which contains all the save-answer tool invocations with the structured answer data. Even though the DB answers were overwritten to NULL, the original data lives in ElevenLabs' API response. The refetch function will extract answers from there.

