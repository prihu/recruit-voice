
Goal: Resolve the persistent “document_not_found” phone ID error even after updating Settings.

1) What I found (root cause)
- The organization row currently still stores the old ID:
  - `organizations.id = f47ac10b-58cc-4372-a567-0e02b2c3d479`
  - `twilio_config.agent_phone_number_id = phnum_1901k3x6cncte3h8m2zfkk8wz4jq`
- `demo-api-bulk-screenings` has a hardcoded upsert in `ensureDemoSetup()` that writes that exact phone ID on request, which can overwrite Settings changes.
- So you can update Settings, but later demo bulk flow can silently reset it back.

2) Implementation plan
- Update `supabase/functions/demo-api-bulk-screenings/index.ts`:
  - Remove hardcoded `twilio_config.agent_phone_number_id` from demo org setup.
  - Change setup logic to:
    - insert org only if missing, OR
    - upsert only non-phone fields without touching `twilio_config`.
- Strengthen `supabase/functions/elevenlabs-voice/index.ts` (`initiate-phone-call`):
  - Add preflight validation of configured `agent_phone_number_id` against ElevenLabs before outbound call.
  - If invalid/not found, return clear 400 error and keep screen in `failed` with actionable `ai_summary`.
- Improve `src/pages/Settings.tsx`:
  - Add “Validate Phone Number ID” action (or validate on save) via edge function call.
  - Show explicit error: “ID not found in the ElevenLabs account tied to current API key.”

3) One-time recovery after code fix
- Re-save the correct `agent_phone_number_id` in Settings (so DB stores valid value after overwrite bug is removed).

4) Technical details
- Files to change:
  - `supabase/functions/demo-api-bulk-screenings/index.ts`
  - `supabase/functions/elevenlabs-voice/index.ts`
  - `src/pages/Settings.tsx`
- No schema migration required.
- This keeps demo mode behavior but stops destructive config resets.

5) Verification checklist
- Save valid phone ID in Settings.
- Trigger bulk flow once, then re-check Settings value (must remain unchanged).
- Open failed screen and click Retry Call.
- Confirm no `document_not_found` error and status moves from `failed` to `in_progress` (or proper call lifecycle).
