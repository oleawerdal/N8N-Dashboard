// In-memory data store. Backs the prototype on serverless platforms
// (Vercel) where a filesystem DB wouldn't persist anyway. For real
// production, replace with Postgres / Neon / Turso.
//
// Note: in serverless, "memory" resets on cold starts. That's fine for
// a testing prototype — demo credentials and mappings re-seed every cold
// start, and any admin changes / received errors live only for the
// warm window. Document this clearly to anyone testing the deploy.

import crypto from "node:crypto";

export type TenancyMode = "shared" | "dedicated";

export type Client = {
  id: number;
  name: string;
  createdAt: string;
  tenancyMode: TenancyMode;
};

export type InstanceStatus =
  | "running"
  | "stopped"
  | "provisioning"
  | "updating"
  | "error";

export type Instance = {
  id: number;
  clientId: number;
  subdomain: string;
  image: string;
  status: InstanceStatus;
  port: number;
  containerName: string;
  envVars: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

export type ClientRole = "viewer" | "operator" | "client_admin";

export type User = {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  role: "admin" | "client";
  clientId: number | null;
  clientRole: ClientRole | null; // only meaningful when role === "client"
  mfaEnabled: boolean;
  passkeyCount: number;
  ssoProvider: "entra" | null;
  createdAt: string;
  lastLoginAt: string | null;
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

export type Settings = {
  branding: {
    brandName: string;
    tagline: string;
    logoUrl: string | null;
    primaryColor: string;
    supportEmail: string;
  };
  auth: {
    emailPassword: { enabled: boolean };
    entra: {
      enabled: boolean;
      tenantId: string;
      clientId: string;
      clientSecretSet: boolean;
      allowedDomains: string;
    };
    mfa: {
      enforced: ("admin" | "client_admin" | "operator" | "viewer")[];
    };
    passkeys: { enabled: boolean };
  };
  emails: Record<string, { subject: string; body: string }>;
};

export const EMAIL_TEMPLATES = [
  {
    key: "invite",
    label: "User invitation",
    sample: { name: "Anna", inviterName: "Ole", loginUrl: "https://…" },
  },
  {
    key: "passwordReset",
    label: "Password reset",
    sample: { name: "Anna", resetUrl: "https://…", expiresIn: "60 minutes" },
  },
  {
    key: "errorAlert",
    label: "Workflow error alert",
    sample: {
      name: "Anna",
      workflowName: "Order Sync",
      nodeName: "Write to Destination",
      message: "ECONNRESET",
      dashboardUrl: "https://…",
    },
  },
] as const;

// Bump when the State shape changes. Warm Vercel lambdas can hold a
// `global.__store` from a previous deploy where new fields don't exist;
// without this guard accesses would crash on first request.
const SCHEMA_VERSION = 3;

type State = {
  schemaVersion: number;
  seeded: boolean;
  clients: Client[];
  users: User[];
  mappings: WorkflowMapping[];
  errors: ErrorEvent[];
  instances: Instance[];
  settings: Settings;
  next: {
    client: number;
    user: number;
    mapping: number;
    error: number;
    instance: number;
  };
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

  const acme: Client = {
    id: s.next.client++,
    name: "Acme Corp",
    createdAt: nowIso,
    tenancyMode: "shared",
  };
  const globex: Client = {
    id: s.next.client++,
    name: "Globex Industries",
    createdAt: nowIso,
    tenancyMode: "dedicated",
  };
  s.clients.push(acme, globex);

  // demo instance for Globex (dedicated tenant)
  s.instances.push({
    id: s.next.instance++,
    clientId: globex.id,
    subdomain: "globex",
    image: "n8nio/n8n:1.95.0",
    status: "running",
    port: 5102,
    containerName: "n8n_globex",
    envVars: {
      N8N_HOST: "globex.n8n.example.com",
      N8N_PROTOCOL: "https",
      WEBHOOK_URL: "https://globex.n8n.example.com",
      GENERIC_TIMEZONE: "Europe/Oslo",
      DB_TYPE: "postgresdb",
      DB_POSTGRESDB_HOST: "globex_db",
      DB_POSTGRESDB_DATABASE: "n8n",
    },
    createdAt: new Date(Date.now() - 14 * 86400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
    lastError: null,
  });

  function user(
    email: string,
    name: string,
    password: string,
    role: "admin" | "client",
    clientId: number | null,
    clientRole: ClientRole | null,
    extras: Partial<Pick<User, "mfaEnabled" | "passkeyCount" | "ssoProvider">> = {}
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
      mfaEnabled: extras.mfaEnabled ?? false,
      passkeyCount: extras.passkeyCount ?? 0,
      ssoProvider: extras.ssoProvider ?? null,
      createdAt: nowIso,
      lastLoginAt: null,
    });
  }
  user("admin@dashboard.local", "Platform Admin", "admin123", "admin", null, null, {
    mfaEnabled: true,
    passkeyCount: 1,
  });
  user("acme-admin@dashboard.local", "Acme Admin", "acme123", "client", acme.id, "client_admin", {
    mfaEnabled: true,
  });
  user("acme@dashboard.local", "Acme Operator", "acme123", "client", acme.id, "operator");
  user("acme-viewer@dashboard.local", "Acme Viewer", "acme123", "client", acme.id, "viewer");
  user("globex-admin@dashboard.local", "Globex Admin", "globex123", "client", globex.id, "client_admin");
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

function defaultSettings(): Settings {
  return {
    branding: {
      brandName: "n8n Dashboard",
      tagline: "Automation, supervised.",
      logoUrl: null,
      primaryColor: "#5b8def",
      supportEmail: "support@example.com",
    },
    auth: {
      emailPassword: { enabled: true },
      entra: {
        enabled: false,
        tenantId: "",
        clientId: "",
        clientSecretSet: false,
        allowedDomains: "",
      },
      mfa: { enforced: ["admin"] },
      passkeys: { enabled: true },
    },
    emails: {
      invite: {
        subject: "{{brandName}}: you've been invited",
        body:
          "Hi {{name}},\n\n{{inviterName}} has invited you to {{brandName}}.\n\nSign in: {{loginUrl}}\n\n— The {{brandName}} team",
      },
      passwordReset: {
        subject: "Reset your {{brandName}} password",
        body:
          "Hi {{name}},\n\nClick the link below to reset your password. It expires in {{expiresIn}}.\n\n{{resetUrl}}\n\nIf you didn't request this, you can ignore the email.",
      },
      errorAlert: {
        subject: "[{{brandName}}] Workflow error: {{workflowName}}",
        body:
          "Hi {{name}},\n\nWorkflow \"{{workflowName}}\" failed.\n\nNode: {{nodeName}}\nMessage: {{message}}\n\nDetails: {{dashboardUrl}}",
      },
    },
  };
}

function getState(): State {
  if (
    !global.__store ||
    global.__store.schemaVersion !== SCHEMA_VERSION
  ) {
    global.__store = {
      schemaVersion: SCHEMA_VERSION,
      seeded: false,
      clients: [],
      users: [],
      mappings: [],
      errors: [],
      instances: [],
      settings: defaultSettings(),
      next: { client: 1, user: 1, mapping: 1, error: 1, instance: 1 },
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
  createInTenant(input: {
    email: string;
    name: string;
    clientId: number;
    clientRole: ClientRole;
  }): User | { error: string } {
    const s = getState();
    if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      return { error: "Email already in use" };
    }
    // Generate a random initial password — the real flow would email
    // an invitation link. In the prototype we just print it.
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const { hash, salt } = hashPw(tempPassword);
    const u: User = {
      id: s.next.user++,
      email: input.email,
      name: input.name,
      passwordHash: hash,
      passwordSalt: salt,
      role: "client",
      clientId: input.clientId,
      clientRole: input.clientRole,
      mfaEnabled: false,
      passkeyCount: 0,
      ssoProvider: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
    s.users.push(u);
    // Attach for the response so the client admin can copy/send it
    // manually until the real invite-email flow is wired up.
    (u as User & { _tempPassword?: string })._tempPassword = tempPassword;
    return u;
  },
  remove(id: number): boolean {
    const s = getState();
    const before = s.users.length;
    s.users = s.users.filter((u) => u.id !== id);
    return s.users.length < before;
  },
  setMfa(id: number, enabled: boolean): boolean {
    const u = this.findById(id);
    if (!u) return false;
    u.mfaEnabled = enabled;
    return true;
  },
  registerPasskey(id: number): boolean {
    const u = this.findById(id);
    if (!u) return false;
    u.passkeyCount += 1;
    return true;
  },
  removePasskeys(id: number): boolean {
    const u = this.findById(id);
    if (!u) return false;
    u.passkeyCount = 0;
    return true;
  },
  recordLogin(id: number) {
    const u = this.findById(id);
    if (u) u.lastLoginAt = new Date().toISOString();
  },
};

export const settings = {
  read(): Settings {
    return getState().settings;
  },
  updateBranding(input: Partial<Settings["branding"]>) {
    const s = getState();
    s.settings.branding = { ...s.settings.branding, ...input };
  },
  updateAuth(input: Partial<Settings["auth"]>) {
    const s = getState();
    s.settings.auth = { ...s.settings.auth, ...input };
  },
  updateEmail(
    key: string,
    template: { subject: string; body: string }
  ): boolean {
    const s = getState();
    if (!(key in s.settings.emails)) return false;
    s.settings.emails[key] = template;
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
  create(name: string, tenancyMode: TenancyMode = "shared"): Client {
    const s = getState();
    const c: Client = {
      id: s.next.client++,
      name,
      createdAt: new Date().toISOString(),
      tenancyMode,
    };
    s.clients.push(c);
    return c;
  },
  setTenancyMode(id: number, tenancyMode: TenancyMode): boolean {
    const c = this.findById(id);
    if (!c) return false;
    c.tenancyMode = tenancyMode;
    return true;
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
    // cascade: drop mappings, instances + unlink users
    s.mappings = s.mappings.filter((m) => m.clientId !== id);
    s.instances = s.instances.filter((i) => i.clientId !== id);
    for (const u of s.users) {
      if (u.clientId === id) {
        u.clientId = null;
        u.clientRole = null;
      }
    }
    return true;
  },
};

export const instances = {
  all(): Instance[] {
    return getState().instances;
  },
  forClient(clientId: number): Instance | undefined {
    return getState().instances.find((i) => i.clientId === clientId);
  },
  findById(id: number): Instance | undefined {
    return getState().instances.find((i) => i.id === id);
  },
  create(input: {
    clientId: number;
    subdomain: string;
    image: string;
    envVars: Record<string, string>;
  }): Instance {
    const s = getState();
    const port = 5100 + s.instances.length + 1;
    const inst: Instance = {
      id: s.next.instance++,
      clientId: input.clientId,
      subdomain: input.subdomain,
      image: input.image,
      status: "provisioning",
      port,
      containerName: `n8n_${input.subdomain}`,
      envVars: input.envVars,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: null,
    };
    s.instances.push(inst);
    return inst;
  },
  patch(
    id: number,
    changes: Partial<
      Pick<Instance, "image" | "envVars" | "status" | "lastError">
    >
  ): Instance | undefined {
    const inst = this.findById(id);
    if (!inst) return undefined;
    Object.assign(inst, changes, { updatedAt: new Date().toISOString() });
    return inst;
  },
  remove(id: number): boolean {
    const s = getState();
    const before = s.instances.length;
    s.instances = s.instances.filter((i) => i.id !== id);
    return s.instances.length < before;
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
