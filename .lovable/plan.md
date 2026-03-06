

## Fix text overflow across the frontend

After reviewing all pages, here are the overflow issues found and the fixes:

### 1. `src/pages/ScreenDetail.tsx`

**Conversation ID overflow (lines 352-363)**
The `<code>` element with `max-w-[200px] truncate` doesn't work because its flex parent lacks `min-w-0`. The outer row also needs `min-w-0`.

Fix:
- Add `min-w-0` to the outer `div.flex` (line 352)
- Add `min-w-0` to the inner `div.flex` (line 354)  
- Add `block` to the `<code>` element so `truncate` works

**Candidate contact info overflow (lines 315-318)**
Long emails/phones can overflow. Fix: add `truncate min-w-0` to the `<span>` elements and `min-w-0` to parent flex containers.

**Candidate name/externalId (lines 312-313)**
Add `truncate` to the name and externalId paragraphs.

**Date/time lines (lines 374-379)**
Long formatted dates can overflow on narrow cards. Wrap the text spans with `truncate` and ensure flex containers have `min-w-0`.

**Transcript chat bubbles (lines 670-674)**
Add `break-words` (`className="text-sm break-words"`) to transcript text to prevent long unbroken strings from overflowing.

**Evaluation criteria question text (line 731)**
Already has `flex-1` but add `break-words` for safety.

**AI Summary (line 704)**
Already has `whitespace-pre-wrap` — add `break-words` for safety.

### 2. `src/pages/Screens.tsx`

**Table cells (lines 383-392)**
Candidate name/phone and role title/location in table cells can overflow on narrow screens. Add `max-w-[200px] truncate` to the inner `<p>` elements.

**Header buttons (lines 239-277)**
On narrow screens, the header buttons row can overflow. Wrap with `flex-wrap`.

### 3. `src/components/layout/AppLayout.tsx`

**Nav bar (line 96)**
On narrow viewports, nav items can overflow. Add `overflow-x-auto` to the nav container.

### 4. `src/pages/RoleDetail.tsx`

**Header title (line 368-369)**
Long role titles can overflow. Add `truncate` and `min-w-0` to the title container.

**Header buttons (lines 396-415)**
Add `flex-wrap` and `shrink-0` to prevent button overflow.

### Summary of changes

| File | Issue | Fix |
|------|-------|-----|
| `ScreenDetail.tsx` | Conversation ID, contact info, dates overflow | Add `min-w-0`, `truncate`, `break-words` to flex children |
| `ScreenDetail.tsx` | Transcript text overflow | Add `break-words` |
| `Screens.tsx` | Table cell text overflow | Add `truncate max-w-[200px]` to cell text |
| `Screens.tsx` | Header buttons overflow | Add `flex-wrap` |
| `AppLayout.tsx` | Nav overflow on narrow screens | Add `overflow-x-auto` |
| `RoleDetail.tsx` | Long title overflow | Add `truncate min-w-0` |

