

## What

Add a warning in the `BulkScreeningModal` that shows which candidates already have active screens for the selected role, before the user clicks "Start Screening." Also update the backend to pre-filter duplicates and return skip info in the response.

## How

### 1. Backend: Pre-check and return skipped candidates (`demo-api-bulk-screenings/index.ts`)

Before inserting, query existing active screens for the role+candidates combo. Filter them out, and include `skipped_candidates` count and a `warning` message in the response.

### 2. Frontend: Check for active screens when role is selected (`BulkScreeningModal.tsx`)

- Add a new function that queries existing screens for the selected role via `demoAPI.getScreenings()` (or a direct supabase query)
- When the role changes, fetch active screens for that role and store the set of candidate IDs that already have active screens
- Show an `Alert` warning banner listing how many candidates already have active screens, and visually mark those candidates in the list (e.g., a badge saying "Already screened")
- Auto-deselect candidates with active screens, or at minimum warn the user

### Changes

**`src/components/BulkScreeningModal.tsx`**:
- Add state: `activeCandidateIds: Set<string>` 
- Add `useEffect` on `selectedRole` change: call `demoAPI.getScreenings()`, filter for screens matching the role with status `pending`/`in_progress`/`scheduled`/`completed`, extract candidate IDs into the set
- In the candidate list, show a "Active screen" badge next to candidates in the set
- Above the candidate list, show a warning Alert when `activeCandidateIds` intersects with `selectedCandidates`
- Filter out active-screen candidates from the count sent to the API (or let the backend handle it with the existing `ignoreDuplicates`)

**`supabase/functions/demo-api-bulk-screenings/index.ts`**:
- Before upsert, query existing screens for the role + candidate IDs
- Filter out already-screened candidates from `screeningData`
- Include `skipped_count` and `warning` in the JSON response

### Files to change
- `src/components/BulkScreeningModal.tsx`
- `supabase/functions/demo-api-bulk-screenings/index.ts`

