

# Fix: Extract Company Name from JD Instead of Organization Table

## Problem

The ElevenLabs agent prompt always says "Demo Company" because it reads `organization.name` from the `organizations` table, which is set to "Demo Company" (since this is a demo/platform account). The actual company name (e.g., "Unicommerce eSolutions Pvt. Ltd.") exists inside the JD text pasted into the role's `summary` field, but is never extracted or used.

## Root Cause

In `generateAgentConfig()`, every reference to the company uses `${organization.name}` which resolves to "Demo Company". The JD in `role.summary` contains the real company name but there's no field on the `roles` table to store it separately.

## Solution

### 1. Add `company_name` column to `roles` table

Add a nullable `company_name` text field to the `roles` table. This lets recruiters specify which company the role is for (since the platform may screen for multiple client companies).

### 2. Add Company Name input to the Role creation/edit UI

In the role's Overview tab (`RoleDetail.tsx`), add a "Company Name" text field. This is the simplest and most reliable approach — rather than trying to auto-extract from unstructured JD text.

### 3. Update `generateAgentConfig()` to use role's company name

In `demo-api-agent-manager/index.ts` and `agent-manager/index.ts`:
- Use `role.company_name || organization.name` everywhere `organization.name` currently appears
- This means: if the role has a company name, use it; otherwise fall back to the org name

### 4. Update `first_message` template

Change:
```
"...screening call from ${organization.name}..."
```
To:
```
"...screening call from ${role.company_name || organization.name}..."
```

Same for the prompt's Personality, Environment, and Goal sections.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `company_name` column to `roles` |
| `src/pages/RoleDetail.tsx` | Add Company Name input field in Overview tab |
| `supabase/functions/demo-api-agent-manager/index.ts` | Use `role.company_name \|\| organization.name` in `generateAgentConfig()` |
| `supabase/functions/agent-manager/index.ts` | Same change |

## ElevenLabs Features Usage

Regarding your question about using ElevenLabs features properly beyond just the prompt — this plan focuses on the immediate "Demo Company" bug. A separate follow-up can restructure the agent config to use:
- **Knowledge Base API** for JD content and FAQs (instead of stuffing them in the prompt)
- **Tools** for structured data collection during the call
- **Post-call analysis** for scoring

That would be a larger refactor and is best done as a separate task.

