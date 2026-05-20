// Thin wrapper around the n8n REST API. When N8N_MODE !== "live" we serve
// deterministic mock data so the prototype is usable without a real instance.

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

const MODE = (process.env.N8N_MODE || "mock").toLowerCase();
const BASE = process.env.N8N_BASE_URL?.replace(/\/$/, "") || "";
const API_KEY = process.env.N8N_API_KEY || "";

function headers() {
  return {
    "X-N8N-API-KEY": API_KEY,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`n8n ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

// ---------- LIVE ----------

async function liveListWorkflows(ids: string[]): Promise<N8nWorkflow[]> {
  if (ids.length === 0) return [];
  const out: N8nWorkflow[] = [];
  for (const id of ids) {
    try {
      const wf = await call<N8nWorkflow>(`/workflows/${id}`);
      out.push(wf);
    } catch {
      // skip workflows the API key can't access or that don't exist
    }
  }
  return out;
}

async function liveListExecutions(
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

async function liveRunWorkflow(workflowId: string): Promise<{ id: string }> {
  // n8n's public API doesn't expose a direct "execute" endpoint;
  // the convention is to call a webhook attached to the workflow.
  // Document this clearly to the user.
  throw new Error(
    "Live manual-run requires a webhook trigger on the workflow. " +
      "Configure N8N_WEBHOOK_PREFIX and the workflow's webhook path, or wire " +
      "this to n8n's internal /rest/workflows/:id/execute if you have access."
  );
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

export const N8N_LIVE = MODE === "live";

export async function listWorkflows(ids: string[]): Promise<N8nWorkflow[]> {
  if (N8N_LIVE) return liveListWorkflows(ids);
  return MOCK_WORKFLOWS.filter((w) => ids.includes(w.id));
}

export async function getWorkflow(id: string): Promise<N8nWorkflow | null> {
  if (N8N_LIVE) {
    try {
      return await call<N8nWorkflow>(`/workflows/${id}`);
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
  if (N8N_LIVE) return liveListExecutions(workflowId, limit);
  return mockExecutionsFor(workflowId, limit);
}

export async function runWorkflow(
  workflowId: string
): Promise<{ executionId: string }> {
  if (N8N_LIVE) {
    const r = await liveRunWorkflow(workflowId);
    return { executionId: r.id };
  }
  // Mock: pretend we started a run
  return { executionId: `exec_${workflowId}_manual_${Date.now()}` };
}

export const _mock = { workflows: MOCK_WORKFLOWS };
