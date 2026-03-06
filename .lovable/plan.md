

## Plan: Align Answer Recovery Logic Across All Edge Functions

### Problem

Four functions process ElevenLabs conversation data but have divergent fallback logic:

| Feature | webhook | refetch | recover-stuck | poll-stuck |
|---------|---------|---------|---------------|------------|
| Transcript tool_calls extraction | Yes (PATH B.5) | Yes (Source 1.5) | **No** | **No** |
| Best-source priority (most answers wins) | No (fixed order) | Yes | No | **No** |
| Security detection | Yes | **No** | Yes | **No** |
| `scoreFromAnswerQuality` with securityFlags | Yes | **No** (missing param) | Yes | **No** |
| `evaluation_criteria_results_list` support | No | Yes | No | **No** |

This means `recover-stuck-screens` and `poll-stuck-screens` can mark screens as "incomplete" even when answers exist in transcript tool_calls. And `poll-stuck-screens` has a completely outdated scoring model.

### Changes

#### 1. `supabase/functions/recover-stuck-screens/index.ts`

Between PATH B (line 288) and PATH C (line 293), insert a PATH B.5 block identical to the webhook's:
- Extract answers from `transcript` tool_calls (same loop logic)
- If answers found, score them with `scoreFromAnswerQuality(toolAnswers, securityFlags)`
- Set `updateData.answers`, `updateData.questions_answered`, `updateData.candidate_responded`
- Only fall through to PATH C if no tool_call answers found either

Also add `evaluation_criteria_results_list` support (currently only handles the object/array format, not the list format that refetch handles).

#### 2. `supabase/functions/poll-stuck-screens/index.ts`

This function is the most outdated. It needs significant updates:
- Add security detection (`INJECTION_PATTERNS`, `MANIPULATION_PATTERNS`, `detectSecurityIssues`, `SecurityFlags`)
- Add `scoreFromAnswerQuality` with `securityFlags` parameter
- Add `evaluation_criteria_results_list` support
- Add PATH B fallback: when no eval criteria, check `screen.answers` (need to add `answers` to the select query on line 36)
- Add PATH B.5 fallback: extract from transcript tool_calls
- Replace the current simplistic scoring (lines 136-197) with the aligned 3-path logic (eval criteria → existingAnswers → transcript tool_calls → incomplete)
- Add `needs_review` as a possible outcome (currently only has pass/fail/incomplete)

#### 3. `supabase/functions/refetch-screen-data/index.ts`

Two fixes to align with webhook/recover:
- Add security detection (duplicate `INJECTION_PATTERNS`, `MANIPULATION_PATTERNS`, `detectSecurityIssues`) -- currently completely missing
- Update `scoreFromAnswerQuality` to accept `securityFlags` parameter (line 8, currently missing the param)

#### 4. `supabase/functions/elevenlabs-webhook/index.ts`

Add `evaluation_criteria_results_list` support to match refetch (currently only handles `evaluation_criteria_results` object/array format). Insert after line 281, before the PATH A scoring block.

### Deploy order
1. Deploy `recover-stuck-screens` first (lowest risk -- manual trigger only)
2. Deploy `poll-stuck-screens` (periodic cron -- verify via logs)
3. Deploy `refetch-screen-data` (manual trigger)
4. Deploy `elevenlabs-webhook` last (highest risk -- handles live calls)

### Summary of what each function gains

- **recover-stuck-screens**: transcript tool_calls extraction, `evaluation_criteria_results_list`
- **poll-stuck-screens**: security detection, `scoreFromAnswerQuality`, answer_quality fallback, transcript tool_calls, `needs_review` outcome, `evaluation_criteria_results_list`
- **refetch-screen-data**: security detection, security-aware scoring
- **elevenlabs-webhook**: `evaluation_criteria_results_list` support

