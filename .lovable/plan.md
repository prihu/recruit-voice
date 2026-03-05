

## Problem

When a new ElevenLabs agent is created (e.g., after updating a role), the Twilio phone number in ElevenLabs remains assigned to the **old** agent. The screenshot confirms: the phone number "Demo" is still pointing to the previous agent. The `demo-api-agent-manager` `create` action never reassigns the phone number to the newly created agent.

## Root Cause

The `create` action in both `demo-api-agent-manager` and `agent-manager` creates a new agent and saves the `voice_agent_id` to the database, but never calls the ElevenLabs API to update the phone number assignment. ElevenLabs phone numbers are bound to a specific agent, so the old agent keeps the phone number.

## Fix

After creating a new agent, use the ElevenLabs API to update the phone number to point to the new agent:

```
PATCH https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}
Body: { "agent_id": "<new_agent_id>" }
```

### Changes

**`supabase/functions/demo-api-agent-manager/index.ts`** — In the `create` case (after agent is created and `voice_agent_id` saved):
- Fetch the organization's `twilio_config.agent_phone_number_id`
- If a phone number ID exists, PATCH the ElevenLabs phone number to assign it to the new agent
- Log success/failure but don't block (non-critical)

**`supabase/functions/agent-manager/index.ts`** — Same change in the `create` case:
- After saving the new agent ID, fetch the org's `twilio_config.agent_phone_number_id`
- PATCH the phone number assignment to the new agent

### Helper function (added to both files):
```typescript
async function reassignPhoneNumber(apiKey: string, phoneNumberId: string, agentId: string) {
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!res.ok) console.error('Failed to reassign phone number:', await res.text());
  else console.log(`Phone number ${phoneNumberId} reassigned to agent ${agentId}`);
}
```

### Files to change
- `supabase/functions/demo-api-agent-manager/index.ts`
- `supabase/functions/agent-manager/index.ts`

