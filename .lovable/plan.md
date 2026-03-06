

## Problem

Three issues prevent answers, scores, and transcript from showing on the ScreenDetail page:

1. **Webhook overwrites save-answer data**: When the call ends, the webhook either overwrites `answers` with evaluation criteria data (which is empty) or doesn't set it at all. The save-answer tool's data is lost.

2. **Answer key mismatch**: Save-answer stores answers as `q_slugified_text` keys, but ScreenDetail looks them up by `question.id` (UUID like `q-1757009933916`). They never match.

3. **Transcript format mismatch**: ElevenLabs returns `{ role: 'user', message: '...' }` but ScreenDetail expects `{ speaker: 'candidate', text: '...' }`.

## Scoring Approach (User Choice: answer_quality from AI agent)

The AI agent already classifies each answer as `good`, `partial`, `poor`, or `skipped` during the call. Mapping:
- `good` = 1.0
- `partial` = 0.5  
- `poor` or `skipped` = 0.0
- Final score = (sum / total answers) * 100
- Pass ≥ 80, Needs Review 60-79, Fail < 60

No external LLM call needed. Zero additional cost.

## Changes

### 1. `supabase/functions/elevenlabs-webhook/index.ts`

**Preserve save-answer data and score from it when no eval criteria:**

- After finding `screenId`, fetch the existing screen record including `answers` and `questions_answered`
- When `evaluation_criteria_results` is empty/missing (the current case), use the existing `answers` from save-answer tool
- Score using `answer_quality`: good=1, partial=0.5, poor/skipped=0
- Calculate outcome using standard thresholds
- Move call quality metrics (conversation_turns, candidate_responded, etc.) **outside** the eval criteria block so they're always set
- Don't overwrite `answers` if save-answer data exists and no eval criteria came back

### 2. `supabase/functions/recover-stuck-screens/index.ts`

Same fallback scoring logic: fetch existing answers from DB, score using `answer_quality` when no eval criteria from ElevenLabs API.

### 3. `src/pages/ScreenDetail.tsx`

**Fix answer display (3 changes):**

- Add a `slugify()` helper function
- For each question in the Answers tab, check both `answers[question.id]` AND `answers['q_' + slugify(question.text)]`
- When the matched value is a save-answer object (has `candidate_answer` field), display `candidate_answer` text and `answer_quality` as a badge

**Fix transcript display:**

- Normalize ElevenLabs format: map `role: 'user'` → `speaker: 'candidate'`, `role: 'agent'` → `speaker: 'agent'`, and `message` → `text`
- Use `time_in_call_secs` to display time instead of requiring a Date timestamp

**Fix Analysis tab:**

- Same slug-based key matching for the Evaluation Results section
- Map `answer_quality` to pass/fail badges (good → pass, poor → fail)

**Add auto-refresh:**

- 10-second polling interval on ScreenDetail (same pattern as Screens list page)

**Wire Download Recording:**

- Link the download button to `screen.recording_url` (open in new tab)

### Technical Detail: Webhook scoring flow

```text
Call ends → Webhook fires
  ├─ Fetch existing screen (answers, questions_answered)
  ├─ Set transcript, duration, recording_url, ai_summary
  ├─ Check evaluation_criteria_results
  │   ├─ Has eval criteria → existing logic (score from pass/fail)
  │   └─ No eval criteria → fallback:
  │       ├─ Read existing answers (from save-answer tool)
  │       ├─ For each answer: good=1, partial=0.5, poor/skipped=0
  │       ├─ score = (sum / count) * 100
  │       └─ outcome = pass/needs_review/fail based on thresholds
  ├─ Always set call quality metrics
  └─ Update screen
```

