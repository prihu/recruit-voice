

# Restructure Agent Config to Use ElevenLabs Native Features

## Current Problem

Everything — JD content, FAQs, screening questions, evaluation criteria, call settings — is crammed into a single massive system prompt (~3000+ chars). This is inefficient because:
- The LLM has to parse through irrelevant content (FAQs, JD details) even when answering simple questions
- No structured data collection — answers are extracted post-call by a separate `extract-structured-data` function re-processing the transcript
- Knowledge base content (FAQs, JD) pollutes the behavioral instructions

## Solution: Use 3 ElevenLabs Native Features

### 1. Knowledge Base API — for FAQs and JD content

**What changes**: Instead of embedding FAQs and JD summary in the prompt, upload them as Knowledge Base documents via the ElevenLabs API, then reference their IDs in the agent config.

**Flow**:
1. When creating/updating an agent, first call `POST /v1/convai/knowledge-base/documents/create-from-text` to create KB documents:
   - **Document 1**: JD content (role summary, responsibilities, skills, location, salary)
   - **Document 2**: FAQs (all Q&A pairs formatted as text)
2. Store the returned document IDs on the `roles` table (new columns: `kb_jd_doc_id`, `kb_faq_doc_id`)
3. Reference these IDs in the agent config under `conversation_config.agent.prompt.knowledge_base`

**Benefit**: ElevenLabs uses RAG to retrieve relevant KB chunks only when needed, rather than the LLM processing the entire JD/FAQ text on every turn.

### 2. Tools API — for structured answer collection

**What changes**: Create a server tool that the agent calls after each screening question to save the candidate's structured response in real-time, rather than extracting everything post-call.

**Flow**:
1. Create a new edge function `elevenlabs-tool-save-answer` that accepts: `{ question_index, question_text, candidate_answer, answer_quality }`
2. Register this as a server tool via `POST /v1/convai/tools` and store the tool ID
3. Reference the tool ID in the agent config under `conversation_config.agent.prompt.tool_ids`
4. The system prompt instructs the agent to call this tool after each question is answered

**Benefit**: Real-time structured data capture during the call. No need for expensive post-call transcript reprocessing.

### 3. Slimmed-down System Prompt — behavior only

**What changes**: The prompt now contains ONLY:
- Personality and tone instructions
- Goal structure (interview flow)
- Guardrails
- Screening questions list (kept in prompt since it drives conversation flow)
- Evaluation criteria (kept in prompt since it guides behavior)

FAQs and JD content are removed from the prompt — they live in the Knowledge Base.

## Database Changes

New columns on `roles` table:
```sql
ALTER TABLE public.roles 
  ADD COLUMN kb_jd_doc_id text,
  ADD COLUMN kb_faq_doc_id text,
  ADD COLUMN tool_save_answer_id text;
```

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `kb_jd_doc_id`, `kb_faq_doc_id`, `tool_save_answer_id` columns to `roles` |
| `supabase/functions/elevenlabs-tool-save-answer/index.ts` | **New** — edge function that receives structured answers from the ElevenLabs tool call and saves to DB |
| `supabase/functions/demo-api-agent-manager/index.ts` | Refactor `generateAgentConfig` + add KB document creation + tool registration logic |
| `supabase/functions/agent-manager/index.ts` | Same refactor for production path |
| `src/integrations/supabase/types.ts` | Auto-updated with new columns |

## Architecture

```text
BEFORE:
  Prompt = Personality + JD + FAQs + Questions + Rules + Settings
  Post-call: extract-structured-data re-reads entire transcript

AFTER:
  Prompt = Personality + Questions + Rules (behavior only)
  Knowledge Base = JD doc + FAQ doc (RAG retrieval)
  Tool = save_answer webhook (real-time structured capture)
  Post-call: extract-structured-data still runs for scoring/summary
```

## Key Implementation Details

- **KB document lifecycle**: When a role's JD or FAQs change, delete old KB docs and create new ones before updating the agent
- **Tool creation**: The `save_answer` tool is created once per workspace (not per role) and reused across agents via `tool_ids`
- **Backward compatibility**: If KB doc IDs are null, the system falls back to embedding content in the prompt (for existing agents)
- **The `extract-structured-data` function stays**: It still handles post-call scoring, AI summary, and outcome determination — the tool just pre-populates raw answers

