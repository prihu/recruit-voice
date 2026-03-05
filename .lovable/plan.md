

## What

Replace the plain "Dashboard" header with a welcoming greeting and inline quick-action shortcut buttons (Create Role, Import Candidates, Start Screening) so the dashboard feels actionable immediately.

## How

**`src/pages/Dashboard.tsx`** — Replace the simple header `<div>` (lines 74-77) with:

- A greeting: "Welcome back" with the current time of day (Morning/Afternoon/Evening)
- Subtitle: "Here's what's happening with your screening pipeline."
- Three inline shortcut buttons using `Link` + `Button`: **New Role** → `/roles`, **Import Candidates** → `/candidates/import`, **View Screens** → `/screens`
- Buttons styled with `variant="outline"` and icons (`FileText`, `Users`, `Phone`) to match the neobrutalist theme

Single file change, ~15 lines replaced.

