# n8n Client Dashboard (prototype)

A multi-tenant, client-facing dashboard for self-hosted n8n. Each client
sees only the workflows you've mapped to them; they can view run history,
per-node execution timings, trigger manual runs, and read error alerts.

This prototype ships with **mock data** so you can click around before
wiring up your real n8n instance.

## Quick start (local)

```bash
npm install
cp .env.example .env
npm run dev
# open http://localhost:3000
```

### Demo logins

| Email                          | Password    | Role                                                  |
| ------------------------------ | ----------- | ----------------------------------------------------- |
| admin@dashboard.local          | admin123    | Admin (sees all + can manage clients/users/workflows) |
| acme@dashboard.local           | acme123     | Acme Corp · operator (can trigger manual runs)        |
| acme-viewer@dashboard.local    | acme123     | Acme Corp · viewer (read-only, no "Run now" button)   |
| globex@dashboard.local         | globex123   | Globex Industries · operator                          |

## Deploy on Vercel (for testing)

1. Push this branch to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), pick this repo, accept defaults.
3. Add one environment variable in the Vercel project settings:
   - `SESSION_SECRET` = any random string at least 32 characters long
4. Deploy. The dashboard runs in mock mode out of the box — share the URL
   and any of the demo logins above.

To point Vercel at your real n8n, also add:

```
N8N_MODE=live
N8N_BASE_URL=https://n8n.yourdomain.com
N8N_API_KEY=<paste an n8n API key>
```

Then redeploy. The API key never reaches the browser — only the server
calls n8n.

> **Note on data persistence:** the prototype keeps state (clients,
> mappings, received errors) in memory. On Vercel that resets on cold
> starts. That's fine for kicking the tires — for production swap
> `src/lib/store.ts` for Postgres (Neon, Supabase) or Turso.

## Wiring up error notifications

1. Create an **Error Workflow** in n8n: `Error Trigger` -> `HTTP Request`.
2. Point the HTTP Request at:

   ```
   POST  https://<this-dashboard>/api/errors
   Body  {
     "workflowId":   "{{$json.workflow.id}}",
     "workflowName": "{{$json.workflow.name}}",
     "executionId":  "{{$json.execution.id}}",
     "nodeName":     "{{$json.execution.lastNodeExecuted}}",
     "message":      "{{$json.execution.error.message}}"
   }
   ```

3. On each client workflow, set this error workflow under
   *Settings -> Error Workflow*. Errors then show up in the **Errors** tab.

## Manual "Run now"

In mock mode the button fakes a started run.

In live mode, n8n's public REST API doesn't expose a generic execute
endpoint — the standard approach is to give each workflow a
**Webhook trigger** node and call that webhook from
`src/lib/n8n.ts -> liveRunWorkflow`. That function is the spot to plug
in your webhook convention (e.g. `${N8N_BASE_URL}/webhook/${workflowId}`).

## Architecture

- **Next.js 15** App Router, server components for data fetching.
- **In-memory store** (`src/lib/store.ts`) holds clients, users, the
  client → workflow ID join table, and received error events. Workflows
  and executions themselves are read live from n8n — no duplication.
- **iron-session** cookie auth — replace with Auth.js / Clerk / SSO for
  production.
- **src/lib/n8n.ts** is the only place that touches the n8n API. Mock
  vs live is switched by `N8N_MODE`.
- **src/lib/access.ts** is the single place that decides which workflow
  IDs a given user can see. Every route uses it; nothing else reaches
  past the join table.

## What's intentionally missing in the prototype

- No real-time updates — pages re-fetch on navigation.
- No pagination on executions (capped at 25).
- "Acknowledge" on error events is in the schema but not wired to UI.
- No background poller for "running" execution status.
- No signup flow / SSO; demo users are seeded on first request.

## Files of interest

- `src/lib/n8n.ts` — n8n API client + mock data
- `src/lib/store.ts` — in-memory store + demo seed
- `src/lib/access.ts` — client → workflow-ID gating
- `src/app/api/errors/route.ts` — webhook endpoint for n8n Error Workflow
- `src/app/(dashboard)/admin/AdminUI.tsx` — client/workflow management
