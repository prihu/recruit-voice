

# Critical Fix Plan: AI Phone Screener

## Executive Summary

After a comprehensive end-to-end analysis of the codebase, I have identified 17 critical issues across 6 categories that need to be addressed. This plan prioritizes fixes based on impact to product functionality and user experience.

---

## Issues Analysis Matrix

| Priority | Category | Issue | Impact | Effort |
|----------|----------|-------|--------|--------|
| P0 | Core Feature | Missing "Human Review" queue | High | 2d |
| P0 | Data Flow | Webhook answers mapping fragile | High | 1d |
| P0 | Database | Missing session_id index | Medium | 0.5d |
| P1 | API | Phone call path inconsistency | Medium | 1d |
| P1 | Safety | No prompt injection detection | Medium | 1.5d |
| P1 | Export | Empty export fixed but untested | Medium | 0.5d |
| P2 | UX | Inconsistent error messages | Low | 1d |
| P2 | Analytics | Time-to-First-Interview not tracked | Low | 1d |
| P2 | Config | Webhook URL displayed incorrectly | Low | 0.5d |
| P3 | Scaling | No pagination for large exports | Low | 1d |

---

## Detailed Issue Breakdown

### CATEGORY 1: Core Feature Gaps

#### Issue 1.1: Missing "Human Review" Queue (P0)
**Location**: `supabase/functions/elevenlabs-webhook/index.ts`, `src/pages/Screens.tsx`

**Current State**:
- Outcomes are binary: `pass`, `fail`, or `incomplete`
- Score threshold is fixed at 60 (lines 235-237 in webhook)
- No mechanism to flag ambiguous candidates

**Product Brief Claim**:
> "The AI doesn't reject anyone. It tags ambiguous candidates for Human Review."

**Fix Required**:
1. Add new outcome value: `needs_review`
2. Update webhook logic:
   - Score 80-100: Auto `pass`
   - Score 60-79: `needs_review` (ambiguous zone)
   - Score 0-59: Auto `fail`
   - Missing/incomplete data: `needs_review`
3. Add "Human Review" filter tab in Screens.tsx
4. Add visual indicator for review-needed screens

**Files to Modify**:
- `supabase/functions/elevenlabs-webhook/index.ts` (lines 230-252)
- `supabase/functions/recover-stuck-screens/index.ts` (lines 158-181)
- `src/pages/Screens.tsx` (add filter option)
- `src/types/index.ts` (update Screen type)

---

#### Issue 1.2: Fragile Answers Mapping (P0)
**Location**: `supabase/functions/elevenlabs-webhook/index.ts` (lines 146-160)

**Current State**:
```typescript
const matchingEval = evalArray.find(e => 
  e.criteria?.toLowerCase().includes(q.text?.toLowerCase().substring(0, 20)) ||
  q.text?.toLowerCase().includes(e.criteria?.toLowerCase().substring(0, 20))
);
```

**Problem**: Uses fuzzy 20-character text matching which will frequently fail when:
- Question text is rephrased in agent prompt
- Criteria names don't match question text
- Multiple questions have similar beginnings

**Fix Required**:
1. Use evaluation criteria names directly instead of fuzzy matching
2. Store raw evaluation results in `extracted_data.evaluation_results`
3. Update ScreenDetail to display evaluation results even without question mapping
4. Add fallback display for unmapped criteria

**Files to Modify**:
- `supabase/functions/elevenlabs-webhook/index.ts` (lines 142-162)
- `src/pages/ScreenDetail.tsx` (lines 630-670)

---

### CATEGORY 2: Database Performance

#### Issue 2.1: Missing session_id Index (P0)
**Location**: Database schema

**Current State**: No index on `screens.session_id` column

**Impact**:
- Webhook lookup by `session_id` (line 63-67 in webhook) does full table scan
- Recovery function queries by `session_id` (line 58 in recover-stuck-screens)
- Will cause significant performance degradation at scale

**Fix Required**:
Create migration with:
```sql
CREATE INDEX IF NOT EXISTS idx_screens_session_id ON screens(session_id);
```

---

#### Issue 2.2: Duplicate Screen Prevention Missing (P1)
**Location**: Database schema

**Current State**: No unique constraint prevents creating duplicate screens for same candidate+role

**Fix Required**:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_screens_candidate_role_active 
ON screens(candidate_id, role_id) 
WHERE status NOT IN ('completed', 'failed');
```

---

### CATEGORY 3: Phone Call Path Inconsistency

#### Issue 3.1: Two Different Phone Call APIs (P1)
**Location**: Multiple files

**Current State**:
1. **Single calls** (`elevenlabs-voice/initiate-phone-call`, line 222-239):
   - Uses: `https://api.elevenlabs.io/v1/convai/conversations/phone-call`
   - Does NOT use Twilio phone number ID
   - Webhook URL: `/functions/v1/elevenlabs-voice/phone-webhook`

2. **Bulk calls** (`process-bulk-screenings/index.ts`, line 230):
   - Uses: `https://api.elevenlabs.io/v1/convai/twilio/outbound-call`
   - Requires: `agent_phone_number_id` from org config
   - Webhook URL: `/functions/v1/elevenlabs-webhook`

**Problems**:
- Single call initiations require different configuration than bulk
- Webhook handlers are different
- Settings page configures Twilio number but single calls ignore it

**Fix Required**:
1. Standardize on ElevenLabs Twilio API for both paths
2. Update `elevenlabs-voice/initiate-phone-call` to use same API as bulk
3. Ensure both use `elevenlabs-webhook` for post-call processing

**Files to Modify**:
- `supabase/functions/elevenlabs-voice/index.ts` (lines 192-294)
- `src/components/VoiceScreening.tsx`

---

### CATEGORY 4: Safety and Guardrails

#### Issue 4.1: No Prompt Injection Detection (P1)
**Location**: `supabase/functions/elevenlabs-webhook/index.ts`

**Current State**:
- Agent prompt includes text-based guardrails (lines 122-133 in agent config)
- No post-processing detection of suspicious patterns
- No logging of potential injection attempts

**Product Brief Claim**:
> "If a candidate tries to prompt-inject... the agent defaults to a neutral response"

**Fix Required**:
1. Add keyword/pattern detection in webhook transcript processing
2. Create detection patterns for common injection attempts:
   - "ignore instructions"
   - "ignore previous"
   - "you are now"
   - "pretend you are"
   - Role/salary manipulation patterns
3. Flag suspicious conversations for review
4. Store flags in `extracted_data.security_flags`

**Files to Modify**:
- `supabase/functions/elevenlabs-webhook/index.ts`
- Create new table or add column for security flags

---

### CATEGORY 5: Export and Analytics

#### Issue 5.1: Export Data Source Fixed but Needs Verification (P1)
**Location**: `src/components/ExportDialog.tsx`

**Current State**:
- Line 147 now correctly handles both `data.screens` and `data.screenings`
- Column mappings added for conversation_id, answers, transcript, analysis

**Remaining Concerns**:
- Large exports may timeout (no pagination)
- PDF export shows "coming soon" but not implemented
- Transcript truncation at 5000 chars may lose data

**Fix Required**:
1. Add streaming/pagination for exports > 1000 records
2. Either implement PDF export or remove the option
3. Consider full transcript in separate download

---

#### Issue 5.2: Time-to-First-Interview Not Tracked (P2)
**Location**: Database schema, Analytics

**Product Brief Claim**:
> "Success Metric: Time-to-First-Interview reduced by 80%"

**Current State**: No actual measurement exists. Time saved is estimated as:
```typescript
// Simple calculation in EnhancedAnalyticsDashboard
totalScreens * 0.25 // hours
```

**Fix Required**:
1. Add `first_interview_at` column to candidates table
2. Track when recruiter advances candidate
3. Calculate actual Time-to-First-Interview metrics
4. Display comparison with industry benchmarks

---

### CATEGORY 6: UX and Configuration

#### Issue 6.1: Incorrect Webhook URL Display (P2)
**Location**: `src/pages/Settings.tsx` (line 244)

**Current State**:
```tsx
{window.location.origin}/functions/v1/elevenlabs-voice/phone-webhook
```

**Problem**: This shows the frontend origin (lovable.app), not the Supabase functions URL

**Fix Required**:
Display the correct Supabase webhook URL:
```
https://yfuroouzxmxlvkwsmtny.supabase.co/functions/v1/elevenlabs-webhook
```

---

#### Issue 6.2: Agent Creation Cost Warning Missing (P2)
**Location**: `src/pages/RoleDetail.tsx`

**Current State**: "Create Agent" button creates real ElevenLabs agents without cost warning

**Fix Required**:
1. Add confirmation dialog before agent creation
2. Display warning that this uses ElevenLabs API credits
3. Show estimated cost if available

---

#### Issue 6.3: Error Messages Are Generic (P2)
**Location**: Various files

**Current State**: Many catch blocks return generic "Failed to..." messages

**Fix Required**:
1. Preserve original error details
2. Add actionable guidance in error messages
3. Log full errors for debugging

---

## Implementation Plan

### Phase 1: Critical Fixes (Days 1-3)

**Day 1**:
1. Add `session_id` index to database
2. Fix webhook outcome logic to include `needs_review`
3. Update Screens.tsx with Human Review filter

**Day 2**:
4. Improve answers mapping in webhook (use raw evaluation results)
5. Update ScreenDetail.tsx to display unmapped evaluations
6. Fix webhook URL display in Settings

**Day 3**:
7. Standardize phone call API path
8. Test single call and bulk call flows

### Phase 2: Safety and Reliability (Days 4-5)

**Day 4**:
9. Add prompt injection detection patterns
10. Add security flags to extracted_data
11. Test with sample injection attempts

**Day 5**:
12. Add duplicate screen prevention constraint
13. Add agent creation confirmation dialog
14. Improve error messages in key flows

### Phase 3: Analytics and Polish (Days 6-7)

**Day 6**:
15. Add Time-to-First-Interview tracking
16. Update analytics dashboard with real metrics

**Day 7**:
17. Add export pagination for large datasets
18. Final testing and documentation updates

---

## Technical Details

### Database Migration Required

```sql
-- Phase 1: Critical indexes
CREATE INDEX IF NOT EXISTS idx_screens_session_id ON screens(session_id);

-- Phase 1: Prevent duplicate active screens
CREATE UNIQUE INDEX IF NOT EXISTS idx_screens_candidate_role_active 
ON screens(candidate_id, role_id) 
WHERE status NOT IN ('completed', 'failed');

-- Phase 2: Security flags (optional - can use extracted_data)
-- No new column needed if using extracted_data.security_flags

-- Phase 3: Time tracking
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_interview_at TIMESTAMPTZ;
```

### Webhook Outcome Logic Update

```typescript
// New logic for lines 230-252 in elevenlabs-webhook/index.ts
if (screeningCompleted) {
  const score = updateData.score as number;
  
  if (score >= 80) {
    updateData.outcome = 'pass';
  } else if (score >= 60) {
    updateData.outcome = 'needs_review';
    updateData.reasons = ['Score in ambiguous range (60-79) - requires human review'];
  } else {
    updateData.outcome = 'fail';
  }
  
  // Also flag for review if confidence is low
  const lowConfidenceItems = evalArray.filter(r => 
    r.confidence !== undefined && r.confidence < 0.7
  );
  if (lowConfidenceItems.length > evalArray.length * 0.3) {
    updateData.outcome = 'needs_review';
    updateData.reasons = [...(updateData.reasons || []), 'Low confidence on multiple criteria'];
  }
} else {
  updateData.outcome = 'incomplete';
}
```

### Screens Filter Update

```typescript
// Add to Screens.tsx outcome filter options
<SelectItem value="needs_review">Needs Review</SelectItem>

// Add Human Review count to stats
const needsReview = screens.filter(s => s.outcome === 'needs_review').length;
```

### Phone Call API Standardization

Update `elevenlabs-voice/initiate-phone-call` to use the same API as bulk:
- API endpoint: `https://api.elevenlabs.io/v1/convai/twilio/outbound-call`
- Require `agent_phone_number_id` from org config
- Use consistent webhook URL

---

## Validation Checklist

After implementation, verify:

- [ ] Human Review queue filters correctly
- [ ] Webhook correctly assigns `needs_review` for scores 60-79
- [ ] Single call uses same API path as bulk calls
- [ ] Session ID lookups are fast (check query plan)
- [ ] Export works with 500+ records
- [ ] Conversation ID displays in screen details
- [ ] Answers tab shows evaluation results even without question mapping
- [ ] Settings page shows correct webhook URL
- [ ] Agent creation shows confirmation dialog

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing screens | Medium | High | Add backward compatibility for existing outcomes |
| API rate limiting during standardization | Low | Medium | Add retry logic with exponential backoff |
| Migration causes downtime | Low | High | Test in staging first, use IF NOT EXISTS |
| Export timeout for large datasets | High | Medium | Implement pagination before fixing |

---

## Files to Modify Summary

**Edge Functions**:
1. `supabase/functions/elevenlabs-webhook/index.ts`
2. `supabase/functions/elevenlabs-voice/index.ts`
3. `supabase/functions/recover-stuck-screens/index.ts`

**Frontend**:
4. `src/pages/Screens.tsx`
5. `src/pages/ScreenDetail.tsx`
6. `src/pages/Settings.tsx`
7. `src/pages/RoleDetail.tsx`
8. `src/types/index.ts`
9. `src/components/ExportDialog.tsx`

**Database**:
10. New migration file for indexes and constraints

