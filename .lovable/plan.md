## Agent Duplication Fix — Completed

### What was fixed

1. **`demo-api-roles/index.ts` PUT handler** — Now checks `role.voice_agent_id`: sends `update` action if agent exists, `create` only if not.
2. **`api-roles/index.ts` PUT handler** — Same conditional logic for production.
3. **`demo-api-agent-manager/index.ts` update case** — Now calls `reassignPhoneNumber()` after successful PATCH.
4. **`agent-manager/index.ts` update case** — Same phone reassignment added.

### Manual cleanup still needed
- Delete orphaned agent `agent_3301k4b6e2ehf5yv342zr08pw05w` from ElevenLabs manually.
- Save the role once to trigger the update flow and reassign the phone number to `agent_4301kjz3qdtgenktm0866qy3wwgf`.
