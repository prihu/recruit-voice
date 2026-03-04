

# Repurpose "Initiate Phone Call" as "Retry Call" for Failed Screens

## Changes

**File: `src/components/VoiceScreening.tsx`**
- Add `screenStatus` prop to the component
- Only render the call button when `screenStatus === 'failed'`
- Change button label from "Initiate Phone Call" to "Retry Call"
- Show a message for non-failed statuses explaining calls are initiated via bulk screening

**File: `src/pages/ScreenDetail.tsx`**
- Pass `screen.status` to the `VoiceScreening` component as `screenStatus`

