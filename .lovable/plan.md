

## Plan: Add Transcript Tool-Calls Extraction to refetch-screen-data

### Single change

**Edit `supabase/functions/refetch-screen-data/index.ts`** — insert a new Source 1.5 block after line 142 (after `collected_tool_results` processing) and before line 144 (before `data_collection_results`).

The new block checks if `toolAnswers` is still empty, then iterates through `transcript` turns looking for `tool_calls` where the tool name contains "save" and "answer". It parses the JSON body to extract `question_text`, `candidate_answer`, and `answer_quality` — identical to the logic already in the webhook's Path B.5.

```typescript
// Source 1.5: Extract from transcript tool_calls (matches webhook fallback)
if (Object.keys(toolAnswers).length === 0 && Array.isArray(transcript)) {
  for (const turn of transcript) {
    for (const call of (turn.tool_calls || [])) {
      const toolName = call.tool_name || '';
      if (toolName.includes('save') && toolName.includes('answer')) {
        try {
          const bodyStr = call.tool_details?.body || call.params_as_json || '';
          const params = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
          const questionText = params.question_text || '';
          const answerText = params.candidate_answer || '';
          const answerQuality = params.answer_quality || 'partial';
          if (questionText) {
            const key = `q_${questionText.toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_|_$/g, '')
              .substring(0, 60)}`;
            toolAnswers[key] = {
              question_text: questionText,
              candidate_answer: answerText,
              answer_quality: answerQuality,
              question_index: params.question_index,
              source: 'transcript_tool_calls',
            };
          }
        } catch (e) { /* skip unparseable */ }
      }
    }
  }
  console.log(`[REFETCH] Extracted ${Object.keys(toolAnswers).length} answers from transcript tool_calls`);
}
```

No other files are changed. Deploy the updated function.

