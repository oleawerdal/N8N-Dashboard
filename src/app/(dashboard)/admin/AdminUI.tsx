"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Workflow = {
  id: number;
  n8nWorkflowId: string;
  displayName: string | null;
};
type ClientUser = {
  id: number;
  email: string;
  name: string;
  clientRole: "viewer" | "operator" | "client_admin";
};
type TenancyMode = "shared" | "dedicated";
type InstanceSummary = {
  id: number;
  subdomain: string;
  image: string;
  status: "running" | "stopped" | "provisioning" | "updating" | "error";
};
type Client = {
  id: number;
  name: string;
  createdAt: string;
  tenancyMode: TenancyMode;
  instance: InstanceSummary | null;
  workflows: Workflow[];
  users: ClientUser[];
};
type AvailableWorkflow = {
  id: string;
  name: string;
  active: boolean;
};

export function AdminUI({
  initial,
  availableWorkflows,
}: {
  initial: Client[];
  availableWorkflows: AvailableWorkflow[];
}) {
  const router = useRouter();
  const [newClient, setNewClient] = useState("");
  const [newTenancy, setNewTenancy] = useState<TenancyMode>("shared");
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);

  async function createClient() {
    if (!newClient.trim()) return;
    await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClient.trim(),
        tenancyMode: newTenancy,
      }),
    });
    setNewClient("");
    setNewTenancy("shared");
    router.refresh();
  }

  async function changeTenancy(clientId: number, tenancyMode: TenancyMode) {
    await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenancyMode }),
    });
    router.refresh();
  }

  async function renameClient(clientId: number, name: string) {
    await fetch(`/api/admin/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  async function deleteClient(clientId: number, name: string) {
    if (
      !confirm(
        `Delete "${name}"?\n\nAll workflow mappings will be removed. User accounts stay but become unassigned.`
      )
    )
      return;
    await fetch(`/api/admin/clients/${clientId}`, { method: "DELETE" });
    router.refresh();
  }

  async function assignWorkflow(clientId: number, n8nWorkflowId: string, displayName?: string) {
    await fetch(`/api/admin/clients/${clientId}/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        n8nWorkflowId,
        displayName: displayName?.trim() || undefined,
      }),
    });
    router.refresh();
  }

  async function removeWorkflow(clientId: number, workflowId: string) {
    await fetch(
      `/api/admin/clients/${clientId}/workflows?workflowId=${encodeURIComponent(workflowId)}`,
      { method: "DELETE" }
    );
    router.refresh();
  }

  async function changeUserRole(
    userId: number,
    clientRole: "viewer" | "operator" | "client_admin"
  ) {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientRole }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="card p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 sm:items-end">
        <div>
          <div className="label mb-1">New client name</div>
          <input
            className="input w-full"
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="e.g. Initech"
          />
        </div>
        <div>
          <div className="label mb-1">Tenancy</div>
          <select
            className="input w-full"
            value={newTenancy}
            onChange={(e) => setNewTenancy(e.target.value as TenancyMode)}
          >
            <option value="shared">shared</option>
            <option value="dedicated">dedicated</option>
          </select>
        </div>
        <button onClick={createClient} className="btn btn-primary">
          Add client
        </button>
      </div>

      {initial.map((c) => {
        const assigned = new Set(c.workflows.map((w) => w.n8nWorkflowId));
        const unassigned = availableWorkflows.filter((w) => !assigned.has(w.id));
        return (
          <div key={c.id} className="card p-4 sm:p-5 space-y-4 sm:space-y-5">
            <ClientHeader
              client={c}
              onRename={(name) => renameClient(c.id, name)}
              onDelete={() => deleteClient(c.id, c.name)}
              onChangeTenancy={(mode) => changeTenancy(c.id, mode)}
            />

            {c.tenancyMode === "dedicated" ? (
              <DedicatedInstanceSection client={c} />
            ) : (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <div className="label">Workflows ({c.workflows.length})</div>
                  {unassigned.length > 0 && (
                    <button
                      className="btn text-xs"
                      onClick={() =>
                        setPickerOpenFor(pickerOpenFor === c.id ? null : c.id)
                      }
                    >
                      {pickerOpenFor === c.id ? "Close picker" : "+ Assign workflow"}
                    </button>
                  )}
                </div>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="data hidden sm:table">
                  <thead>
                    <tr>
                      <th>n8n Workflow ID</th>
                      <th>Display name override</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.workflows.map((w) => (
                      <tr key={w.id}>
                        <td className="font-mono text-xs">{w.n8nWorkflowId}</td>
                        <td>
                          {w.displayName || (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => removeWorkflow(c.id, w.n8nWorkflowId)}
                            className="btn text-xs"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {c.workflows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-6">
                          No workflows assigned yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="sm:hidden">
                  {c.workflows.map((w) => (
                    <div key={w.id} className="list-row">
                      <div className="font-medium text-sm">
                        {w.displayName || (
                          <span className="text-muted">
                            (no display name)
                          </span>
                        )}
                      </div>
                      <div className="row-meta font-mono text-xs">
                        {w.n8nWorkflowId}
                      </div>
                      <button
                        onClick={() => removeWorkflow(c.id, w.n8nWorkflowId)}
                        className="btn text-xs self-start"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {c.workflows.length === 0 && (
                    <div className="text-center text-muted py-6 text-sm">
                      No workflows assigned yet.
                    </div>
                  )}
                </div>
              </div>
                {pickerOpenFor === c.id && (
                  <WorkflowPicker
                    available={unassigned}
                    onAssign={(id, name) => assignWorkflow(c.id, id, name)}
                  />
                )}
              </section>
            )}

            <section>
              <div className="label mb-2">Users ({c.users.length})</div>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="data hidden sm:table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.users.map((u) => (
                      <tr key={u.id}>
                        <td className="font-mono text-xs">{u.email}</td>
                        <td>{u.name}</td>
                        <td>
                          <select
                            className="input text-xs py-1"
                            value={u.clientRole}
                            onChange={(e) =>
                              changeUserRole(
                                u.id,
                                e.target.value as
                                  | "viewer"
                                  | "operator"
                                  | "client_admin"
                              )
                            }
                          >
                            <option value="viewer">viewer (read-only)</option>
                            <option value="operator">
                              operator (can run manually)
                            </option>
                            <option value="client_admin">
                              client admin (manages team)
                            </option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {c.users.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted py-6">
                          No users for this client yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="sm:hidden">
                  {c.users.map((u) => (
                    <div key={u.id} className="list-row">
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="row-meta font-mono text-xs break-all">
                        {u.email}
                      </div>
                      <select
                        className="input text-xs py-1"
                        value={u.clientRole}
                        onChange={(e) =>
                          changeUserRole(
                            u.id,
                            e.target.value as
                              | "viewer"
                              | "operator"
                              | "client_admin"
                          )
                        }
                      >
                        <option value="viewer">viewer (read-only)</option>
                        <option value="operator">
                          operator (can run manually)
                        </option>
                        <option value="client_admin">
                          client admin (manages team)
                        </option>
                      </select>
                    </div>
                  ))}
                  {c.users.length === 0 && (
                    <div className="text-center text-muted py-6 text-sm">
                      No users for this client yet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}

function ClientHeader({
  client,
  onRename,
  onDelete,
  onChangeTenancy,
}: {
  client: Client;
  onRename: (name: string) => void;
  onDelete: () => void;
  onChangeTenancy: (mode: TenancyMode) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(client.name);
  function save() {
    if (draft.trim() && draft !== client.name) onRename(draft.trim());
    setEditing(false);
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input text-lg font-semibold flex-1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") {
                  setDraft(client.name);
                  setEditing(false);
                }
              }}
            />
            <button onClick={save} className="btn btn-primary text-xs">
              Save
            </button>
            <button
              onClick={() => {
                setDraft(client.name);
                setEditing(false);
              }}
              className="btn text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold truncate">{client.name}</h3>
            <button
              onClick={() => setEditing(true)}
              className="text-muted hover:text-white text-xs shrink-0"
              title="Rename"
              aria-label="Rename"
            >
              ✏️
            </button>
          </div>
        )}
        <div className="text-xs text-muted">Client #{client.id}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <TenancyBadge
          mode={client.tenancyMode}
          onChange={onChangeTenancy}
          hasInstance={!!client.instance}
        />
        <button
          onClick={onDelete}
          className="btn text-xs text-red-400 hover:bg-red-950/40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function TenancyBadge({
  mode,
  onChange,
  hasInstance,
}: {
  mode: TenancyMode;
  onChange: (mode: TenancyMode) => void;
  hasInstance: boolean;
}) {
  const color =
    mode === "dedicated"
      ? "bg-blue-950/50 text-blue-300 border-blue-800/50"
      : "bg-emerald-950/40 text-emerald-300 border-emerald-800/50";
  return (
    <div className={`px-2 py-1 rounded-md border text-xs ${color}`}>
      <select
        value={mode}
        onChange={(e) => {
          const next = e.target.value as TenancyMode;
          if (
            next === "shared" &&
            hasInstance &&
            !confirm(
              "Switching to shared will leave the dedicated instance orphaned (you'll need to destroy it from the Instances page). Continue?"
            )
          ) {
            return;
          }
          onChange(next);
        }}
        className="bg-transparent border-none outline-none"
      >
        <option value="shared">shared tenancy</option>
        <option value="dedicated">dedicated tenancy</option>
      </select>
    </div>
  );
}

function DedicatedInstanceSection({ client }: { client: Client }) {
  if (!client.instance) {
    return (
      <div className="border border-dashed border-border rounded-md p-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">No dedicated instance yet</div>
          <div className="text-muted text-xs mt-1">
            This client has dedicated tenancy but no n8n container exists.
          </div>
        </div>
        <a href="/admin/instances" className="btn btn-primary text-sm shrink-0">
          Provision →
        </a>
      </div>
    );
  }
  const inst = client.instance;
  const statusColor =
    inst.status === "running"
      ? "bg-emerald-400"
      : inst.status === "error"
      ? "bg-red-500"
      : "bg-amber-400";
  return (
    <div className="border border-border rounded-md p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${statusColor}`}
        />
        <div className="min-w-0">
          <div className="font-medium truncate">
            {inst.subdomain}.n8n.example.com
          </div>
          <div className="text-xs text-muted font-mono truncate">
            {inst.image} · {inst.status}
          </div>
        </div>
      </div>
      <a href="/admin/instances" className="btn text-sm shrink-0">
        Manage →
      </a>
    </div>
  );
}

function WorkflowPicker({
  available,
  onAssign,
}: {
  available: AvailableWorkflow[];
  onAssign: (id: string, displayName?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const filtered = available.filter(
    (w) =>
      w.id.toLowerCase().includes(query.toLowerCase()) ||
      w.name.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div className="mt-3 border border-border rounded-md p-3 space-y-3 bg-[#0d1117]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="text-sm font-medium">Available n8n workflows</div>
        <input
          className="input text-sm w-full sm:w-auto"
          placeholder="Search by name or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="max-h-96 overflow-y-auto divide-y divide-border">
        {filtered.map((w) => (
          <div
            key={w.id}
            className="flex flex-col sm:flex-row sm:items-center gap-2 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{w.name}</div>
              <div className="text-xs text-muted font-mono truncate">
                {w.id} · {w.active ? "active" : "inactive"}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="input text-xs flex-1 sm:w-40 sm:flex-none"
                placeholder="Display name (optional)"
                value={displayNames[w.id] || ""}
                onChange={(e) =>
                  setDisplayNames((s) => ({ ...s, [w.id]: e.target.value }))
                }
              />
              <button
                className="btn btn-primary text-xs shrink-0"
                onClick={() => onAssign(w.id, displayNames[w.id])}
              >
                Assign
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted py-6 text-sm">
            {available.length === 0
              ? "All available workflows are already assigned to this client."
              : "No matches."}
          </div>
        )}
      </div>
    </div>
  );
}
