// Application data store.
//
// Two backends, selected at runtime:
//   - DATABASE_URL set  -> Postgres. State is persisted as a JSON snapshot
//     (see db.ts) and survives redeploys/restarts. A fresh database is
//     seeded with a single platform admin only (no demo tenants).
//   - DATABASE_URL unset -> in-memory. Seeded with the full demo data set
//     so the prototype is clickable without any infra. Resets on restart.
//
// The public API is async because the Postgres backend loads/persists
// asynchronously. The in-memory working copy is cached on `global.__store`
// for the lifetime of the process.

import crypto from "node:crypto";
import { USE_PG, loadSnapshot, saveSnapshot } from "./db";

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
  mail: {
    provider: "smtp2go" | "none";
    apiKeySet: boolean;
    fromEmail: string;
    fromName: string;
    lastTestAt: string | null;
    lastTestOk: boolean | null;
    lastTestError: string | null;
  };
  n8n: {
    mode: "mock" | "live";
    baseUrl: string;
    apiKeySet: boolean;
  };
  emails: Record<string, { subject: string; body: string }>;
};

// Secrets live outside Settings so we don't accidentally JSON-serialize
// them in API responses. Only accessed server-side via mail.ts / n8n.ts.
type Secrets = {
  mailApiKey: string | null;
  n8nApiKey: string | null;
};

export const EMAIL_TEMPLATES = [
  {
    key: "invite",
    label: "User invitation",
    sample: {
      name: "Anna",
      inviterName: "Ole",
      loginUrl: "https://…",
      tempPassword: "Xq7n-Ab3-pT9k",
    },
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

// Bump when the State shape changes in a way old in-memory copies can't
// satisfy. On Postgres the loaded snapshot is normalized against the
// current defaults rather than wiped, so a bump won't drop persisted data.
const SCHEMA_VERSION = 6;

type State = {
  schemaVersion: number;
  seeded: boolean;
  clients: Client[];
  users: User[];
  mappings: WorkflowMapping[];
  errors: ErrorEvent[];
  instances: Instance[];
  settings: Settings;
  secrets: Secrets;
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

export function verifyPassword(password: string, hash: string, salt: string) {
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function addUser(
  s: State,
  fields: {
    email: string;
    name: string;
    password: string;
    role: "admin" | "client";
    clientId: number | null;
    clientRole: ClientRole | null;
    mfaEnabled?: boolean;
    passkeyCount?: number;
    ssoProvider?: "entra" | null;
  }
): User {
  const { hash, salt } = hashPw(fields.password);
  const u: User = {
    id: s.next.user++,
    email: fields.email,
    name: fields.name,
    passwordHash: hash,
    passwordSalt: salt,
    role: fields.role,
    clientId: fields.clientId,
    clientRole: fields.clientRole,
    mfaEnabled: fields.mfaEnabled ?? false,
    passkeyCount: fields.passkeyCount ?? 0,
    ssoProvider: fields.ssoProvider ?? null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  s.users.push(u);
  return u;
}

// Fresh, empty state with default settings. Env-based mail bootstrap is
// applied here so a first boot can pick up SMTP2GO_API_KEY automatically.
function freshState(): State {
  const settings = defaultSettings();
  const envApiKey = process.env.SMTP2GO_API_KEY || null;
  if (envApiKey) {
    settings.mail.provider = "smtp2go";
    settings.mail.apiKeySet = true;
  }
  // Bootstrap the n8n connection from env so existing env-based deploys
  // keep working; it's then editable in the admin UI and persisted.
  const envN8nKey = process.env.N8N_API_KEY || null;
  if (envN8nKey) settings.n8n.apiKeySet = true;
  return {
    schemaVersion: SCHEMA_VERSION,
    seeded: false,
    clients: [],
    users: [],
    mappings: [],
    errors: [],
    instances: [],
    settings,
    secrets: { mailApiKey: envApiKey, n8nApiKey: envN8nKey },
    next: { client: 1, user: 1, mapping: 1, error: 1, instance: 1 },
  };
}

// Production seed (Postgres, fresh DB): a single platform admin so the
// operator can sign in. Credentials come from env, falling back to the
// well-known demo login (change it immediately).
function seedInitialAdmin(s: State) {
  addUser(s, {
    email: (process.env.ADMIN_EMAIL || "admin@dashboard.local")
      .trim()
      .toLowerCase(),
    name: process.env.ADMIN_NAME || "Platform Admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
    role: "admin",
    clientId: null,
    clientRole: null,
    mfaEnabled: false,
  });
  s.seeded = true;
}

// Demo seed (in-memory only): fictional tenants, users, mappings, errors.
function seedDemo(s: State) {
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

  addUser(s, {
    email: "admin@dashboard.local",
    name: "Platform Admin",
    password: "admin123",
    role: "admin",
    clientId: null,
    clientRole: null,
    mfaEnabled: true,
    passkeyCount: 1,
  });
  addUser(s, {
    email: "acme-admin@dashboard.local",
    name: "Acme Admin",
    password: "acme123",
    role: "client",
    clientId: acme.id,
    clientRole: "client_admin",
    mfaEnabled: true,
  });
  addUser(s, {
    email: "acme@dashboard.local",
    name: "Acme Operator",
    password: "acme123",
    role: "client",
    clientId: acme.id,
    clientRole: "operator",
  });
  addUser(s, {
    email: "acme-viewer@dashboard.local",
    name: "Acme Viewer",
    password: "acme123",
    role: "client",
    clientId: acme.id,
    clientRole: "viewer",
  });
  addUser(s, {
    email: "globex-admin@dashboard.local",
    name: "Globex Admin",
    password: "globex123",
    role: "client",
    clientId: globex.id,
    clientRole: "client_admin",
  });
  addUser(s, {
    email: "globex@dashboard.local",
    name: "Globex Operator",
    password: "globex123",
    role: "client",
    clientId: globex.id,
    clientRole: "operator",
  });

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
    mail: {
      provider: "none",
      apiKeySet: false,
      fromEmail: process.env.MAIL_FROM_EMAIL || "noreply@example.com",
      fromName: process.env.MAIL_FROM_NAME || "n8n Dashboard",
      lastTestAt: null,
      lastTestOk: null,
      lastTestError: null,
    },
    n8n: {
      mode:
        (process.env.N8N_MODE || "mock").toLowerCase() === "live"
          ? "live"
          : "mock",
      baseUrl: (process.env.N8N_BASE_URL || "").replace(/\/$/, ""),
      apiKeySet: false,
    },
    emails: {
      invite: {
        subject: "{{brandName}}: you've been invited",
        body:
          "Hi {{name}},\n\n{{inviterName}} has invited you to {{brandName}}.\n\nSign in here: {{loginUrl}}\nTemporary password: {{tempPassword}}\n\nYou'll be asked to set a new password the first time you sign in.\n\n— The {{brandName}} team",
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

// Merge a loaded snapshot over current defaults so a schema bump that adds
// fields doesn't crash on older persisted data — and never wipes it.
function normalize(data: Partial<State>): State {
  const base = freshState();
  const settings = (data.settings ?? {}) as Partial<Settings>;
  return {
    schemaVersion: SCHEMA_VERSION,
    seeded: true,
    clients: data.clients ?? [],
    users: data.users ?? [],
    mappings: data.mappings ?? [],
    errors: data.errors ?? [],
    instances: data.instances ?? [],
    settings: {
      branding: { ...base.settings.branding, ...settings.branding },
      auth: { ...base.settings.auth, ...settings.auth },
      mail: { ...base.settings.mail, ...settings.mail },
      n8n: { ...base.settings.n8n, ...settings.n8n },
      emails: { ...base.settings.emails, ...settings.emails },
    },
    secrets: { ...base.secrets, ...(data.secrets as Secrets | undefined) },
    next: { ...base.next, ...(data.next as State["next"] | undefined) },
  };
}

let statePromise: Promise<State> | null = null;

async function initState(): Promise<State> {
  if (USE_PG) {
    const snap = await loadSnapshot();
    if (snap) return normalize(snap.data as Partial<State>);
    const s = freshState();
    seedInitialAdmin(s);
    await saveSnapshot(SCHEMA_VERSION, s);
    return s;
  }
  const s = freshState();
  seedDemo(s);
  return s;
}

async function getState(): Promise<State> {
  if (global.__store && global.__store.schemaVersion === SCHEMA_VERSION) {
    return global.__store;
  }
  if (!statePromise) {
    statePromise = initState()
      .then((s) => {
        global.__store = s;
        statePromise = null;
        return s;
      })
      .catch((e) => {
        statePromise = null;
        throw e;
      });
  }
  return statePromise;
}

async function persist(s: State): Promise<void> {
  if (USE_PG) await saveSnapshot(SCHEMA_VERSION, s);
}

// ---------- queries ----------

export const users = {
  async findById(id: number): Promise<User | undefined> {
    return (await getState()).users.find((u) => u.id === id);
  },
  async findByEmail(email: string): Promise<User | undefined> {
    const lower = email.toLowerCase();
    return (await getState()).users.find(
      (u) => u.email.toLowerCase() === lower
    );
  },
  async forClient(clientId: number): Promise<User[]> {
    return (await getState()).users
      .filter((u) => u.role === "client" && u.clientId === clientId)
      .sort((a, b) => a.email.localeCompare(b.email));
  },
  async listAdmins(): Promise<User[]> {
    return (await getState()).users
      .filter((u) => u.role === "admin")
      .sort((a, b) => a.email.localeCompare(b.email));
  },
  async updateClientRole(id: number, role: ClientRole): Promise<boolean> {
    const s = await getState();
    const u = s.users.find((x) => x.id === id);
    if (!u || u.role !== "client") return false;
    u.clientRole = role;
    await persist(s);
    return true;
  },
  async createAdmin(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<User | { error: string }> {
    const s = await getState();
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) return { error: "A valid email is required" };
    if (!input.password || input.password.length < 8) {
      return { error: "Password must be at least 8 characters" };
    }
    if (s.users.some((u) => u.email.toLowerCase() === email)) {
      return { error: "Email already in use" };
    }
    const u = addUser(s, {
      email,
      name: input.name.trim() || email,
      password: input.password,
      role: "admin",
      clientId: null,
      clientRole: null,
    });
    await persist(s);
    return u;
  },
  async createInTenant(input: {
    email: string;
    name: string;
    clientId: number;
    clientRole: ClientRole;
  }): Promise<User | { error: string }> {
    const s = await getState();
    if (
      s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())
    ) {
      return { error: "Email already in use" };
    }
    // Generate a random initial password — the real flow emails an
    // invitation link. In the prototype we surface it to the inviter.
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const u = addUser(s, {
      email: input.email,
      name: input.name,
      password: tempPassword,
      role: "client",
      clientId: input.clientId,
      clientRole: input.clientRole,
    });
    await persist(s);
    (u as User & { _tempPassword?: string })._tempPassword = tempPassword;
    return u;
  },
  async remove(id: number): Promise<boolean> {
    const s = await getState();
    const target = s.users.find((u) => u.id === id);
    if (!target) return false;
    // Never strand the platform: refuse to delete the last admin.
    if (target.role === "admin") {
      const admins = s.users.filter((u) => u.role === "admin").length;
      if (admins <= 1) return false;
    }
    s.users = s.users.filter((u) => u.id !== id);
    await persist(s);
    return true;
  },
  async setMfa(id: number, enabled: boolean): Promise<boolean> {
    const s = await getState();
    const u = s.users.find((x) => x.id === id);
    if (!u) return false;
    u.mfaEnabled = enabled;
    await persist(s);
    return true;
  },
  async registerPasskey(id: number): Promise<boolean> {
    const s = await getState();
    const u = s.users.find((x) => x.id === id);
    if (!u) return false;
    u.passkeyCount += 1;
    await persist(s);
    return true;
  },
  async removePasskeys(id: number): Promise<boolean> {
    const s = await getState();
    const u = s.users.find((x) => x.id === id);
    if (!u) return false;
    u.passkeyCount = 0;
    await persist(s);
    return true;
  },
  async recordLogin(id: number): Promise<void> {
    const s = await getState();
    const u = s.users.find((x) => x.id === id);
    if (u) {
      u.lastLoginAt = new Date().toISOString();
      await persist(s);
    }
  },
};

export const settings = {
  async read(): Promise<Settings> {
    return (await getState()).settings;
  },
  async updateBranding(input: Partial<Settings["branding"]>): Promise<void> {
    const s = await getState();
    s.settings.branding = { ...s.settings.branding, ...input };
    await persist(s);
  },
  async updateAuth(input: Partial<Settings["auth"]>): Promise<void> {
    const s = await getState();
    s.settings.auth = { ...s.settings.auth, ...input };
    await persist(s);
  },
  async updateEmail(
    key: string,
    template: { subject: string; body: string }
  ): Promise<boolean> {
    const s = await getState();
    if (!(key in s.settings.emails)) return false;
    s.settings.emails[key] = template;
    await persist(s);
    return true;
  },
  async updateMail(input: {
    provider?: "smtp2go" | "none";
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
  }): Promise<void> {
    const s = await getState();
    if (input.provider !== undefined) s.settings.mail.provider = input.provider;
    if (input.fromEmail !== undefined)
      s.settings.mail.fromEmail = input.fromEmail;
    if (input.fromName !== undefined) s.settings.mail.fromName = input.fromName;
    if (input.apiKey !== undefined) {
      const trimmed = input.apiKey.trim();
      if (trimmed) {
        s.secrets.mailApiKey = trimmed;
        s.settings.mail.apiKeySet = true;
      } else if (trimmed === "") {
        s.secrets.mailApiKey = null;
        s.settings.mail.apiKeySet = false;
      }
    }
    await persist(s);
  },
  async recordMailTest(ok: boolean, error: string | null): Promise<void> {
    const s = await getState();
    s.settings.mail.lastTestAt = new Date().toISOString();
    s.settings.mail.lastTestOk = ok;
    s.settings.mail.lastTestError = error;
    await persist(s);
  },
  async _internalMailKey(): Promise<string | null> {
    return (await getState()).secrets.mailApiKey;
  },
  async updateN8n(input: {
    mode?: "mock" | "live";
    baseUrl?: string;
    apiKey?: string; // empty string = clear; undefined = leave alone
  }): Promise<void> {
    const s = await getState();
    if (input.mode !== undefined) s.settings.n8n.mode = input.mode;
    if (input.baseUrl !== undefined) {
      s.settings.n8n.baseUrl = input.baseUrl.trim().replace(/\/$/, "");
    }
    if (input.apiKey !== undefined) {
      const trimmed = input.apiKey.trim();
      if (trimmed) {
        s.secrets.n8nApiKey = trimmed;
        s.settings.n8n.apiKeySet = true;
      } else if (trimmed === "") {
        s.secrets.n8nApiKey = null;
        s.settings.n8n.apiKeySet = false;
      }
    }
    await persist(s);
  },
  async _internalN8nKey(): Promise<string | null> {
    return (await getState()).secrets.n8nApiKey;
  },
};

export const clients = {
  async list(): Promise<Client[]> {
    return [...(await getState()).clients].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  },
  async findById(id: number): Promise<Client | undefined> {
    return (await getState()).clients.find((c) => c.id === id);
  },
  async create(name: string, tenancyMode: TenancyMode = "shared"): Promise<Client> {
    const s = await getState();
    const c: Client = {
      id: s.next.client++,
      name,
      createdAt: new Date().toISOString(),
      tenancyMode,
    };
    s.clients.push(c);
    await persist(s);
    return c;
  },
  async setTenancyMode(id: number, tenancyMode: TenancyMode): Promise<boolean> {
    const s = await getState();
    const c = s.clients.find((x) => x.id === id);
    if (!c) return false;
    c.tenancyMode = tenancyMode;
    await persist(s);
    return true;
  },
  async rename(id: number, name: string): Promise<boolean> {
    const s = await getState();
    const c = s.clients.find((x) => x.id === id);
    if (!c) return false;
    c.name = name;
    await persist(s);
    return true;
  },
  async remove(id: number): Promise<boolean> {
    const s = await getState();
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
    await persist(s);
    return true;
  },
};

export const instances = {
  async all(): Promise<Instance[]> {
    return (await getState()).instances;
  },
  async forClient(clientId: number): Promise<Instance | undefined> {
    return (await getState()).instances.find((i) => i.clientId === clientId);
  },
  async findById(id: number): Promise<Instance | undefined> {
    return (await getState()).instances.find((i) => i.id === id);
  },
  async create(input: {
    clientId: number;
    subdomain: string;
    image: string;
    envVars: Record<string, string>;
  }): Promise<Instance> {
    const s = await getState();
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
    await persist(s);
    return inst;
  },
  async patch(
    id: number,
    changes: Partial<
      Pick<Instance, "image" | "envVars" | "status" | "lastError">
    >
  ): Promise<Instance | undefined> {
    const s = await getState();
    const inst = s.instances.find((i) => i.id === id);
    if (!inst) return undefined;
    Object.assign(inst, changes, { updatedAt: new Date().toISOString() });
    await persist(s);
    return inst;
  },
  async remove(id: number): Promise<boolean> {
    const s = await getState();
    const before = s.instances.length;
    s.instances = s.instances.filter((i) => i.id !== id);
    const changed = s.instances.length < before;
    if (changed) await persist(s);
    return changed;
  },
};

export const mappings = {
  async all(): Promise<WorkflowMapping[]> {
    return (await getState()).mappings;
  },
  async forClient(clientId: number): Promise<WorkflowMapping[]> {
    return (await getState()).mappings.filter((m) => m.clientId === clientId);
  },
  async exists(clientId: number, n8nWorkflowId: string): Promise<boolean> {
    return (await getState()).mappings.some(
      (m) => m.clientId === clientId && m.n8nWorkflowId === n8nWorkflowId
    );
  },
  async create(
    clientId: number,
    n8nWorkflowId: string,
    displayName: string | null
  ): Promise<WorkflowMapping | null> {
    const s = await getState();
    if (
      s.mappings.some(
        (m) => m.clientId === clientId && m.n8nWorkflowId === n8nWorkflowId
      )
    )
      return null;
    const m: WorkflowMapping = {
      id: s.next.mapping++,
      clientId,
      n8nWorkflowId,
      displayName,
    };
    s.mappings.push(m);
    await persist(s);
    return m;
  },
  async remove(clientId: number, n8nWorkflowId: string): Promise<void> {
    const s = await getState();
    s.mappings = s.mappings.filter(
      (m) => !(m.clientId === clientId && m.n8nWorkflowId === n8nWorkflowId)
    );
    await persist(s);
  },
};

export const errors = {
  async recentForWorkflows(
    workflowIds: string[],
    limit = 100
  ): Promise<ErrorEvent[]> {
    if (workflowIds.length === 0) return [];
    const set = new Set(workflowIds);
    return (await getState()).errors
      .filter((e) => set.has(e.n8nWorkflowId))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, limit);
  },
  async unreadCountForWorkflows(workflowIds: string[]): Promise<number> {
    if (workflowIds.length === 0) return 0;
    const set = new Set(workflowIds);
    return (await getState()).errors.filter(
      (e) => !e.acknowledged && set.has(e.n8nWorkflowId)
    ).length;
  },
  async create(input: {
    n8nWorkflowId: string;
    workflowName?: string | null;
    executionId?: string | null;
    nodeName?: string | null;
    message?: string | null;
  }): Promise<ErrorEvent> {
    const s = await getState();
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
    await persist(s);
    return e;
  },
};
