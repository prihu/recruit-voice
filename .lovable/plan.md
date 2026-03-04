

# Fix ElevenLabs KB and Tool API Endpoints

## Problem Found

The edge function logs show two clear errors when syncing the agent:
```
Failed to create KB doc: {"detail":"Not Found"}
Failed to create tool: {"detail":"Method Not Allowed"}
```

The agent prompt itself updates correctly (shows "Unicommerce"), but KB documents and the server tool are never created because the API endpoints are wrong.

## Root Causes

| Feature | Current (Wrong) Endpoint | Correct Endpoint |
|---------|--------------------------|-------------------|
| KB create | `POST /v1/convai/knowledge-base/documents/create-from-text` | `POST /v1/convai/knowledge-base/text` |
| KB delete | `DELETE /v1/convai/knowledge-base/documents/{id}` | `DELETE /v1/convai/knowledge-base/{id}` |
| Tool create | `POST /v1/convai/agents/tools` | `POST /v1/convai/tools` |

Additionally, the tool reference format in the agent config uses `tools: [{ tool_id }]` under `prompt`, but per ElevenLabs' deprecation notice, it should use `tool_ids: [id]` under `prompt`.

## Changes

### 1. Fix KB endpoints in both agent-manager files

- `createKBDocument`: Change URL to `https://api.elevenlabs.io/v1/convai/knowledge-base/text`
- `deleteKBDocument`: Change URL to `https://api.elevenlabs.io/v1/convai/knowledge-base/{docId}`

### 2. Fix Tool endpoint in both agent-manager files

- `ensureSaveAnswerTool`: Change URL to `https://api.elevenlabs.io/v1/convai/tools`

### 3. Fix tool reference format in `generateAgentConfig`

Change from:
```js
tools: [{ tool_id: toolId }]
```
To:
```js
tool_ids: [toolId]
```

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/demo-api-agent-manager/index.ts` | Fix 3 API URLs + tool_ids format |
| `supabase/functions/agent-manager/index.ts` | Same fixes |

### Verification

After deploying, re-sync the agent and check edge function logs to confirm KB docs and tool are created successfully.
