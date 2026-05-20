// In-memory data store. Backs the prototype on serverless platforms
// (Vercel) where a filesystem DB wouldn't persist anyway. For real
// production, replace with Postgres / Neon / Turso.
//
// Note: in serverless, "memory" resets on cold starts. That's fine for
// a testing prototype — demo credentials and mappings re-seed every cold
// start, and any admin changes / received errors live only for the
// warm window. Document this clearly to anyone testing the deploy.

import crypto from "node:crypto";

export type Client = {
  id: number;
  name: string;
  createdAt: string;
};

export type ClientRole = "viewer" | "operator";

export type User = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  role: "admin" | "client";
  clientId: number | null;
  clientRole: ClientRole | null; // only meaningful when role === "client"
};

export type WorkflowMapping = {
  id: number;
  clientId: number;
  n8nWorkflowId: string;
  displayName: string | null;
};

export type ErrorEvent = {
  id: number;
  receivedAt: string;
  n8nWorkflowId: string;
  workflowName: string | null;
  executionId: string | null;
  nodeName: string | null;
  message: string | null;
  acknowledged: boolean;
};

type State = {
  seeded: boolean;
  clients: Client[];
  users: User[];
  mappings: WorkflowMapping[];
  errors: ErrorEvent[];
  next: { client: number; user: number; mapping: number; error: number };
};

declare global {
  // eslint-disable-next-line no-var
  var __store: State | undefined;
}

function hashPw(password: string, salt?: string) {
  const useSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, useSalt, 64).toString("hex");
  return { hash, salt: useSalt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string
) {
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(candidate, "hex"),
    Buffer.from(hash, "hex")
  );
}

function seed(s: State) {
  const nowIso = new Date().toISOString();

  const acme: Client = { id: s.next.client++, name: "Acme Corp", createdAt: nowIso };
  const globex: Client = { id: s.next.client++, name: "Globex Industries", createdAt: nowIso };
  s.clients.push(acme, globex);

  function user(
    email: string,
    name: string,
    password: string,
    role: "admin" | "client",
    clientId: number | null,
    clientRole: ClientRole | null
  ) {
    const { hash, salt } = hashPw(password);
    s.users.push({
      id: s.next.user++,
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      role,
      clientId,
      clientRole,
    });
  }
  user("admin@dashboard.local", "Admin", "admin123", "admin", null, null);
  user("acme@dashboard.local", "Acme Operator", "acme123", "client", acme.id, "operator");
  user("acme-viewer@dashboard.local", "Acme Viewer", "acme123", "client", acme.id, "viewer");
  user("globex@dashboard.local", "Globex Operator", "globex123", "client", globex.id, "operator");

  function map(clientId: number, n8nWorkflowId: string, displayName: string | null) {
    s.mappings.push({
      id: s.next.mapping++,
      clientId,
      n8nWorkflowId,
      displayName,
    });
  }
  map(acme.id, "wf_001", "Order → Accounting Sync");
  map(acme.id, "wf_002", "Lead Pipeline");
  map(acme.id, "wf_003", "Support Triage");
  map(globex.id, "wf_101", "Inventory Alerts");
  map(globex.id, "wf_102", "Weekly KPI Report");

  function err(
    minutesAgo: number,
    n8nWorkflowId: string,
    workflowName: string,
    executionId: string,
    nodeName: string,
    message: string
  ) {
    s.errors.push({
      id: s.next.error++,
      receivedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      n8nWorkflowId,
      workflowName,
      executionId,
      nodeName,
      message,
      acknowledged: false,
    });
  }
  err(
    60,
    "wf_001",
    "Daily Shopify → QuickBooks Sync",
    "exec_wf_001_988",
    "Write to Destination",
    "ECONNRESET: connection reset while POSTing to destination"
  );
  err(
    60 * 24,
    "wf_002",
    "Lead Enrichment (HubSpot)",
    "exec_wf_002_950",
    "Transform",
    "TypeError: Cannot read properties of undefined (reading 'email')"
  );
  err(
    60 * 24 * 2,
    "wf_101",
    "Inventory Reorder Alerts",
    "exec_wf_101_900",
    "Notify",
    "SMTP 550: relay denied"
  );

  s.seeded = true;
}

function getState(): State {
  if (!global.__store) {
    global.__store = {
      seeded: false,
      clients: [],
      users: [],
      mappings: [],
      errors: [],
      next: { client: 1, user: 1, mapping: 1, error: 1 },
    };
  }
  if (!global.__store.seeded) seed(global.__store);
  return global.__store;
}

// ---------- queries ----------

export const users = {
  findById(id: number): User | undefined {
    return getState().users.find((u) => u.id === id);
  },
  findByEmail(email: string): User | undefined {
    return getState().users.find((u) => u.email === email);
  },
  forClient(clientId: number): User[] {
    return getState()
      .users.filter((u) => u.role === "client" && u.clientId === clientId)
      .sort((a, b) => a.email.localeCompare(b.email));
  },
  updateClientRole(id: number, role: ClientRole): boolean {
    const u = this.findById(id);
    if (!u || u.role !== "client") return false;
    u.clientRole = role;
    return true;
  },
};

export const clients = {
  list(): Client[] {
    return [...getState().clients].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },
  findById(id: number): Client | undefined {
    return getState().clients.find((c) => c.id === id);
  },
  create(name: string): Client {
    const s = getState();
    const c: Client = {
      id: s.next.client++,
      name,
      createdAt: new Date().toISOString(),
    };
    s.clients.push(c);
    return c;
  },
  rename(id: number, name: string): boolean {
    const c = this.findById(id);
    if (!c) return false;
    c.name = name;
    return true;
  },
  remove(id: number): boolean {
    const s = getState();
    const before = s.clients.length;
    s.clients = s.clients.filter((c) => c.id !== id);
    if (s.clients.length === before) return false;
    // cascade: drop mappings + unlink users
    s.mappings = s.mappings.filter((m) => m.clientId !== id);
    for (const u of s.users) {
      if (u.clientId === id) {
        u.clientId = null;
        u.clientRole = null;
      }
    }
    return true;
  },
};

export const mappings = {
  all(): WorkflowMapping[] {
    return getState().mappings;
  },
  forClient(clientId: number): WorkflowMapping[] {
    return getState().mappings.filter((m) => m.clientId === clientId);
  },
  exists(clientId: number, n8nWorkflowId: string): boolean {
    return getState().mappings.some(
      (m) => m.clientId === clientId && m.n8nWorkflowId === n8nWorkflowId
    );
  },
  create(
    clientId: number,
    n8nWorkflowId: string,
    displayName: string | null
  ): WorkflowMapping | null {
    const s = getState();
    if (this.exists(clientId, n8nWorkflowId)) return null;
    const m: WorkflowMapping = {
      id: s.next.mapping++,
      clientId,
      n8nWorkflowId,
      displayName,
    };
    s.mappings.push(m);
    return m;
  },
  remove(clientId: number, n8nWorkflowId: string) {
    const s = getState();
    s.mappings = s.mappings.filter(
      (m) =>
        !(m.clientId === clientId && m.n8nWorkflowId === n8nWorkflowId)
    );
  },
};

export const errors = {
  recentForWorkflows(workflowIds: string[], limit = 100): ErrorEvent[] {
    if (workflowIds.length === 0) return [];
    const set = new Set(workflowIds);
    return getState()
      .errors.filter((e) => set.has(e.n8nWorkflowId))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, limit);
  },
  unreadCountForWorkflows(workflowIds: string[]): number {
    if (workflowIds.length === 0) return 0;
    const set = new Set(workflowIds);
    return getState().errors.filter(
      (e) => !e.acknowledged && set.has(e.n8nWorkflowId)
    ).length;
  },
  create(input: {
    n8nWorkflowId: string;
    workflowName?: string | null;
    executionId?: string | null;
    nodeName?: string | null;
    message?: string | null;
  }): ErrorEvent {
    const s = getState();
    const e: ErrorEvent = {
      id: s.next.error++,
      receivedAt: new Date().toISOString(),
      n8nWorkflowId: input.n8nWorkflowId,
      workflowName: input.workflowName ?? null,
      executionId: input.executionId ?? null,
      nodeName: input.nodeName ?? null,
      message: input.message ?? null,
      acknowledged: false,
    };
    s.errors.push(e);
    return e;
  },
};
