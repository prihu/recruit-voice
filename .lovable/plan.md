

# Deduplicate Candidates in Bulk Screening Modal

## Problem
The candidate list in the Bulk Screening modal shows duplicate entries (same name + phone appearing multiple times), likely from repeated CSV imports.

## Solution
Add client-side deduplication in `fetchCandidates` inside `BulkScreeningModal.tsx`. Dedupe by **phone number** (primary unique identifier for screening calls) — if two candidates share the same phone, keep only the first (most recently updated or first encountered).

## Change

**File: `src/components/BulkScreeningModal.tsx`**

In `fetchCandidates`, after fetching candidates, deduplicate by phone number before setting state:

```typescript
const candidatesData = await demoAPI.getCandidates();
// Deduplicate by phone number (keep first occurrence)
const seen = new Set<string>();
const uniqueCandidates = candidatesData.filter((candidate: any) => {
  const phone = candidate.phone?.replace(/\s+/g, '');
  if (!phone || seen.has(phone)) return false;
  seen.add(phone);
  return true;
});
setCandidates(uniqueCandidates);
```

This normalizes phone numbers (strips whitespace) and keeps only the first candidate per unique phone, eliminating duplicates from repeated imports.

