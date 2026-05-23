// Thin wrapper around the n8n REST API. Connection config (mode, base URL,
// API key) is read from the admin settings store, so it can be managed in
// the web UI and persisted — env vars only seed the initial values.

import { settings } from "./store";

export type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
  createdAt: string;
  tags?: { id: string; name: string }[];
};

export type N8nNodeRun = {
  node: string;
  startedAt: string;
  executionTimeMs: number;
  status: "success" | "error";
  errorMessage?: string;
};

export type N8nExecution = {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "success" | "error" | "running" | "waiting";
  mode: "manual" | "trigger" | "webhook" | "retry";
  startedAt: string;
  stoppedAt?: string;
  durationMs?: number;
  nodes: N8nNodeRun[];
};

type N8nConfig = { live: boolean; base: string; apiKey: string };

async function n8nConfig(): Promise<N8nConfig> {
  const cfg = await settings.read();
  const apiKey = (await settings._internalN8nKey()) || "";
  return {
    live: cfg.n8n.mode === "live",
    base: cfg.n8n.baseUrl.replace(/\/$/, ""),
    apiKey,
  };
}

function headers(apiKey: string) {
  return {
    "X-N8N-API-KEY": apiKey,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function call<T>(
  base: string,
  apiKey: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${base}/api/v1${path}`, {
    ...init,
    headers: { ...headers(apiKey), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`n8n ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ---------- LIVE ----------

async function liveListWorkflows(
  base: string,
  apiKey: string,
  ids: string[]
): Promise<N8nWorkflow[]> {
  if (ids.length === 0) return [];
  const out: N8nWorkflow[] = [];
  for (const id of ids) {
    try {
      const wf = await call<N8nWorkflow>(base, apiKey, `/workflows/${id}`);
      out.push(wf);
    } catch {
      // skip workflows the API key can't access or that don't exist
    }
  }
  return out;
}

async function liveListAllWorkflows(
  base: string,
  apiKey: string
): Promise<{ id: string; name: string; active: boolean }[]> {
  const body = await call<{
    data: Array<{ id: string; name: string; active: boolean }>;
  }>(base, apiKey, `/workflows?limit=250`);
  return body.data.map((w) => ({ id: w.id, name: w.name, active: w.active }));
}

async function liveListExecutions(
  base: string,
  apiKey: string,
  workflowId: string,
  limit = 25
): Promise<N8nExecution[]> {
  type Raw = {
    data: Array<{
      id: string;
      workflowId: string;
      finished: boolean;
      status?: string;
      mode: string;
      startedAt: string;
      stoppedAt?: string;
      data?: {
        resultData?: {
          runData?: Record<
            string,
            Array<{
              startTime: number;
              executionTime: number;
              error?: { message?: string };
            }>
          >;
        };
      };
    }>;
  };
  const r = await call<Raw>(
    base,
    apiKey,
    `/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}&includeData=true`
  );
  return r.data.map((e) => {
    const runData = e.data?.resultData?.runData || {};
    const nodes: N8nNodeRun[] = Object.entries(runData).flatMap(
      ([node, runs]) =>
        runs.map((run) => ({
          node,
          startedAt: new Date(run.startTime).toISOString(),
          executionTimeMs: run.executionTime,
          status: run.error ? "error" : "success",
          errorMessage: run.error?.message,
        }))
    );
    const started = new Date(e.startedAt).getTime();
    const stopped = e.stoppedAt ? new Date(e.stoppedAt).getTime() : undefined;
    return {
      id: e.id,
      workflowId: e.workflowId,
      workflowName: "",
      status:
        (e.status as N8nExecution["status"]) ||
        (e.finished ? "success" : "running"),
      mode: e.mode as N8nExecution["mode"],
      startedAt: e.startedAt,
      stoppedAt: e.stoppedAt,
      durationMs: stopped ? stopped - started : undefined,
      nodes,
    };
  });
}

// n8n's public API has no generic "execute" endpoint; the supported way
// to trigger a workflow externally is a Webhook node. We POST to its
// production URL. `webhookUrl` may be a full URL or just the path/segment
// after /webhook/.
async function liveRunViaWebhook(
  base: string,
  webhookUrl: string
): Promise<void> {
  const url = webhookUrl.includes("://")
    ? webhookUrl
    : `${base}/webhook/${webhookUrl.replace(/^\/+/, "")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "n8n-dashboard",
      triggeredAt: new Date().toISOString(),
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Webhook returned ${res.status}: ${(await res.text()).slice(0, 300)}`
    );
  }
}

// ---------- MOCK ----------

const MOCK_WORKFLOWS: N8nWorkflow[] = [
  {
    id: "wf_001",
    name: "Daily Shopify → QuickBooks Sync",
    active: true,
    updatedAt: "2026-05-19T08:30:00Z",
    createdAt: "2025-11-01T10:00:00Z",
    tags: [{ id: "t1", name: "billing" }],
  },
  {
    id: "wf_002",
    name: "Lead Enrichment (HubSpot)",
    active: true,
    updatedAt: "2026-05-18T16:12:00Z",
    createdAt: "2025-12-14T09:00:00Z",
    tags: [{ id: "t2", name: "sales" }],
  },
  {
    id: "wf_003",
    name: "Support Ticket Triage",
    active: false,
    updatedAt: "2026-05-10T11:00:00Z",
    createdAt: "2026-01-20T09:00:00Z",
  },
  {
    id: "wf_101",
    name: "Inventory Reorder Alerts",
    active: true,
    updatedAt: "2026-05-19T07:00:00Z",
    createdAt: "2025-10-05T09:00:00Z",
  },
  {
    id: "wf_102",
    name: "Weekly KPI Email",
    active: true,
    updatedAt: "2026-05-13T07:00:00Z",
    createdAt: "2025-09-12T09:00:00Z",
  },
];

function seededRand(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function mockExecutionsFor(workflowId: string, count = 25): N8nExecution[] {
  const wf = MOCK_WORKFLOWS.find((w) => w.id === workflowId);
  if (!wf) return [];
  const seed = [...workflowId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRand(seed);
  const now = Date.now();
  const out: N8nExecution[] = [];
  for (let i = 0; i < count; i++) {
    const startedAt = new Date(now - i * 3600_000 * (1 + rand())).toISOString();
    const isError = rand() < 0.12;
    const isRunning = i === 0 && rand() < 0.15;
    const nodes: N8nNodeRun[] = [
      "Trigger",
      "Fetch Data",
      "Transform",
      "Write to Destination",
      "Notify",
    ].map((node, idx) => {
      const execMs = Math.round(40 + rand() * 1200 + idx * 80);
      const errOnThisNode = isError && idx === 3;
      return {
        node,
        startedAt: new Date(
          new Date(startedAt).getTime() + idx * execMs
        ).toISOString(),
        executionTimeMs: execMs,
        status: errOnThisNode ? "error" : "success",
        errorMessage: errOnThisNode
          ? "ECONNRESET: connection reset while POSTing to destination"
          : undefined,
      };
    });
    const totalMs = nodes.reduce((s, n) => s + n.executionTimeMs, 0);
    out.push({
      id: `exec_${workflowId}_${1000 - i}`,
      workflowId,
      workflowName: wf.name,
      status: isRunning ? "running" : isError ? "error" : "success",
      mode: i % 5 === 0 ? "manual" : "trigger",
      startedAt,
      stoppedAt: isRunning
        ? undefined
        : new Date(new Date(startedAt).getTime() + totalMs).toISOString(),
      durationMs: isRunning ? undefined : totalMs,
      nodes,
    });
  }
  return out;
}

// ---------- PUBLIC ----------

export async function isN8nLive(): Promise<boolean> {
  return (await n8nConfig()).live;
}

export async function listWorkflows(ids: string[]): Promise<N8nWorkflow[]> {
  const { live, base, apiKey } = await n8nConfig();
  if (live) return liveListWorkflows(base, apiKey, ids);
  return MOCK_WORKFLOWS.filter((w) => ids.includes(w.id));
}

export async function getWorkflow(id: string): Promise<N8nWorkflow | null> {
  const { live, base, apiKey } = await n8nConfig();
  if (live) {
    try {
      return await call<N8nWorkflow>(base, apiKey, `/workflows/${id}`);
    } catch {
      return null;
    }
  }
  return MOCK_WORKFLOWS.find((w) => w.id === id) || null;
}

export async function listExecutions(
  workflowId: string,
  limit = 25
): Promise<N8nExecution[]> {
  const { live, base, apiKey } = await n8nConfig();
  if (live) return liveListExecutions(base, apiKey, workflowId, limit);
  return mockExecutionsFor(workflowId, limit);
}

// Every workflow visible to the API key (live) or the full mock catalog.
// Powers the admin "assign workflow to client" picker.
export async function listAllWorkflows(): Promise<
  { id: string; name: string; active: boolean }[]
> {
  const { live, base, apiKey } = await n8nConfig();
  if (!live) {
    return MOCK_WORKFLOWS.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
    }));
  }
  return liveListAllWorkflows(base, apiKey);
}

export async function runWorkflow(
  workflowId: string,
  webhookUrl?: string | null
): Promise<{ executionId: string }> {
  const { live, base } = await n8nConfig();
  if (live) {
    if (!webhookUrl) {
      throw new Error(
        "No webhook configured for this workflow. In Admin → Clients, add the " +
          "workflow's production Webhook URL (from its Webhook node in n8n)."
      );
    }
    await liveRunViaWebhook(base, webhookUrl);
    return { executionId: `webhook_${workflowId}_${Date.now()}` };
  }
  // Mock: pretend we started a run
  return { executionId: `exec_${workflowId}_manual_${Date.now()}` };
}

// Test an arbitrary base URL / key (used by the admin "Test connection"
// button before the config is saved). Returns the workflow count on success.
export async function testN8nConnection(
  base: string,
  apiKey: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const cleanBase = base.trim().replace(/\/$/, "");
  if (!cleanBase) return { ok: false, error: "Base URL is required" };
  try {
    const body = await call<{ data: unknown[] }>(
      cleanBase,
      apiKey,
      `/workflows?limit=1`
    );
    return { ok: true, count: Array.isArray(body.data) ? body.data.length : 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
