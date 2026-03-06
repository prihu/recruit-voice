

## Plan: Add Transcript Tool-Call Fallback to Webhook

### Problem
Currently, the webhook has three scoring paths:
- **Path A**: ElevenLabs evaluation criteria (rarely populated)
- **Path B**: Existing `answers` from save-answer tool in DB
- **Path C**: Nothing found → marks as "incomplete"

If the save-answer tool fails during the call (network issue, timeout, etc.), Path B has no data and it falls to Path C. But the transcript from ElevenLabs contains the tool_calls with all the answer data embedded in each agent turn.

### Solution
Add a **Path B.5** between Path B and Path C: extract answers from `tool_calls` within the webhook's transcript data. This is the same logic validated in the refetch function.

### Change: `supabase/functions/elevenlabs-webhook/index.ts`

After the existing Path B check (line ~349) and before Path C (line ~369), add a new fallback:

```
} else if (Object.keys(existingAnswers).length > 0) {
  // PATH B — existing logic stays unchanged
  ...
} else {
  // NEW PATH B.5: Try extracting from transcript tool_calls
  const toolAnswers: Record<string, any> = {};
  if (Array.isArray(transcript)) {
    for (const turn of transcript) {
      for (const call of (turn.tool_calls || [])) {
        const toolName = call.tool_name || '';
        if (toolName.includes('save') && toolName.includes('answer')) {
          try {
            const bodyStr = call.tool_details?.body || call.params_as_json || '';
            const params = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
            const questionText = params.question_text || '';
            if (questionText) {
              const key = `q_${questionText.toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '')
                .substring(0, 60)}`;
              toolAnswers[key] = {
                question_text: questionText,
                candidate_answer: params.candidate_answer || '',
                answer_quality: params.answer_quality || 'partial',
                question_index: params.question_index,
                source: 'webhook_transcript_tool_calls',
              };
            }
          } catch (e) { /* skip */ }
        }
      }
    }
  }

  if (Object.keys(toolAnswers).length > 0) {
    // Score from recovered tool call data
    updateData.answers = toolAnswers;
    updateData.questions_answered = Object.keys(toolAnswers).length;
    updateData.candidate_responded = true;
    const { score, outcome, reasons } = scoreFromAnswerQuality(toolAnswers, securityFlags);
    updateData.score = score;
    updateData.outcome = outcome;
    if (reasons.length > 0) updateData.reasons = reasons;
    console.log(`[WEBHOOK] Recovered ${Object.keys(toolAnswers).length} answers from transcript tool_calls`);
  } else {
    // Original PATH C: truly no data
    updateData.outcome = 'incomplete';
    updateData.score = 0;
    updateData.reasons = ['Screening incomplete - no answers captured'];
  }
}
```

### What this means in simple terms

Right now, the webhook relies on the save-answer tool having already written answers to the database during the call. If that step fails for any reason (network glitch, race condition, timeout), the webhook sees zero answers and marks the screening as "incomplete" — even though the answers are sitting right there in the transcript.

With this change, before giving up, the webhook will look inside the transcript for any tool calls that contain answer data and use those instead. This makes the system self-healing: even if real-time answer saving fails, the webhook will recover the data automatically. No manual "Re-fetch" button needed.

### No other files change
This is a single-file edit to the webhook. The scoring logic (`scoreFromAnswerQuality`) already exists in the file.

