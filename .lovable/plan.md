

## Step-by-Step Root Cause Analysis: Why Two Agents Exist

### Timeline of Events

1. **Original agent created (Sep 5, 2025)**: "Senior Product Manager - Demo Company" (`agent_3301k4b6e2ehf5yv342zr08pw05w`) was created when the role was first set up. The phone number was manually assigned to this agent in ElevenLabs at that time.

2. **Role updated with company_name = "Unicommerce" (Mar 5, 2026)**: When you saved the role with the company name changed to "Unicommerce", the PUT handler in `demo-api-roles/index.ts` (line 224) fired the agent manager with `{ action: 'create', roleId }`. This **always sends `create`**, regardless of whether the role already has a `voice_agent_id`.

3. **New agent created (Mar 5, 2026)**: The `create` case in `demo-api-agent-manager` does **not check** if `role.voice_agent_id` already exists. It unconditionally creates a brand new ElevenLabs agent. This produced "Senior Product Manager - Unicommerce" (`agent_4301kjz3qdtgenktm0866qy3wwgf`), and the DB was updated to point to this new agent.

4. **Phone reassignment code was added but came AFTER the agent was already created**: The phone reassignment fix I added was deployed after the `agent_4301...` agent already existed. So it never ran for that agent. The phone number remained bound to the old `agent_3301...`.

### Why My Previous Fixes Didn't Solve This

**Fix 1 — Phone reassignment helper**: I added `reassignPhoneNumber()` to the `create` case. This is correct code, but it only runs on the **next** agent creation. Since the current agent (`agent_4301...`) was created **before** this code was deployed, it never benefited from it.

**Fix 2 — Plan to use 'update' instead of 'create'**: This was approved as a plan but **never implemented in code**. Line 224 of `demo-api-roles/index.ts` still reads:
```
body: JSON.stringify({ action: 'create', roleId }),
```
It should branch based on whether `role.voice_agent_id` exists.

### The Two Concrete Problems

1. **`demo-api-roles` PUT handler always sends `action: 'create'`** (line 224) — This creates a new ElevenLabs agent on every role save, orphaning the previous one.

2. **`demo-api-agent-manager` `create` case doesn't check for existing `voice_agent_id`** (line 441+) — Even if `create` is called, it should detect that the role already has an agent and either update it or skip creation.

### Proposed Fix

**File: `supabase/functions/demo-api-roles/index.ts`** (lines 218-228)
- After the DB update returns the role, check `role.voice_agent_id`:
  - If exists → send `{ action: 'update', agentId: role.voice_agent_id, updates: { roleId } }`
  - If not → send `{ action: 'create', roleId }`

**File: `supabase/functions/demo-api-agent-manager/index.ts`** (update case, ~line 620+)
- After successful PATCH of the agent, also call `reassignPhoneNumber()` to ensure the phone number stays bound to the correct agent.

**Manual cleanup needed**: Delete the orphaned old agent `agent_3301k4b6e2ehf5yv342zr08pw05w` ("Senior Product Manager - Demo Company") from ElevenLabs manually, since it's no longer referenced by the database.

### Files to change
- `supabase/functions/demo-api-roles/index.ts` — conditional action in PUT handler
- `supabase/functions/demo-api-agent-manager/index.ts` — add phone reassignment to update case

