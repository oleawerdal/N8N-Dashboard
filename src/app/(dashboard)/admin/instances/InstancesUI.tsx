"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type InstanceRow = {
  id: number;
  clientId: number;
  clientName: string;
  subdomain: string;
  image: string;
  status: "running" | "stopped" | "provisioning" | "updating" | "error";
  port: number;
  containerName: string;
  envVars: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};
type EligibleClient = { id: number; name: string };
type LogLine = { timestamp: string; stream: "stdout" | "stderr"; message: string };

const DEFAULT_IMAGE = "n8nio/n8n:1.95.0";
const AVAILABLE_VERSIONS = [
  "n8nio/n8n:latest",
  "n8nio/n8n:1.95.0",
  "n8nio/n8n:1.94.1",
  "n8nio/n8n:1.93.0",
];

export function InstancesUI({
  initial,
  eligibleClients,
}: {
  initial: InstanceRow[];
  eligibleClients: EligibleClient[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {eligibleClients.length > 0 ? (
          <button
            className="btn btn-primary"
            onClick={() => setCreating(true)}
          >
            + Provision new instance
          </button>
        ) : (
          <div className="text-xs text-muted">
            No eligible clients. Switch a client to "dedicated" tenancy first.
          </div>
        )}
      </div>

      {creating && (
        <ProvisionForm
          clients={eligibleClients}
          onClose={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      <div className="space-y-3">
        {initial.map((inst) => (
          <InstanceCard
            key={inst.id}
            inst={inst}
            isExpanded={expanded === inst.id}
            onToggle={() =>
              setExpanded(expanded === inst.id ? null : inst.id)
            }
            onChange={() => router.refresh()}
          />
        ))}
        {initial.length === 0 && (
          <div className="card p-8 text-center text-muted">
            No dedicated instances yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ProvisionForm({
  clients,
  onClose,
}: {
  clients: EligibleClient[];
  onClose: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? 0);
  const [subdomain, setSubdomain] = useState("");
  const [image, setImage] = useState(DEFAULT_IMAGE);
  const [envInput, setEnvInput] = useState(
    "N8N_PROTOCOL=https\nGENERIC_TIMEZONE=Europe/Oslo\nN8N_ENCRYPTION_KEY=GENERATE_ON_PROVISION"
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const envVars = parseEnv(envInput);
    const res = await fetch("/api/admin/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, subdomain, image, envVars }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Provision failed");
      return;
    }
    onClose();
  }

  return (
    <div className="card p-5 space-y-4 border-accent/40">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Provision new n8n instance</h3>
        <button onClick={onClose} className="btn text-xs">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="label mb-1">Client</div>
          <select
            className="input w-full"
            value={clientId}
            onChange={(e) => setClientId(Number(e.target.value))}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label mb-1">Subdomain</div>
          <div className="flex items-center gap-1">
            <input
              className="input flex-1"
              value={subdomain}
              onChange={(e) =>
                setSubdomain(e.target.value.replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="acme"
            />
            <span className="text-muted text-sm">.n8n.example.com</span>
          </div>
        </div>
        <div className="col-span-2">
          <div className="label mb-1">n8n version (Docker image)</div>
          <select
            className="input w-full"
            value={image}
            onChange={(e) => setImage(e.target.value)}
          >
            {AVAILABLE_VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <div className="label mb-1">Environment variables (KEY=value, one per line)</div>
          <textarea
            className="input w-full font-mono text-xs"
            rows={6}
            value={envInput}
            onChange={(e) => setEnvInput(e.target.value)}
          />
          <div className="text-xs text-muted mt-1">
            `N8N_ENCRYPTION_KEY` will be auto-generated on the server if left
            as the placeholder. Database settings are added automatically
            (one Postgres per instance).
          </div>
        </div>
      </div>
      {err && (
        <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
          {err}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          disabled={busy || !subdomain}
          onClick={submit}
          className="btn btn-primary"
        >
          {busy ? "Provisioning..." : "Provision instance"}
        </button>
      </div>
    </div>
  );
}

function InstanceCard({
  inst,
  isExpanded,
  onToggle,
  onChange,
}: {
  inst: InstanceRow;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [imageDraft, setImageDraft] = useState(inst.image);
  const [envDraft, setEnvDraft] = useState(
    Object.entries(inst.envVars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n")
  );
  const [logs, setLogs] = useState<LogLine[] | null>(null);
  const [tab, setTab] = useState<"env" | "version" | "logs" | null>(null);

  async function restart() {
    setBusy("restart");
    await fetch(`/api/admin/instances/${inst.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restart" }),
    });
    setBusy(null);
    onChange();
  }
  async function updateVersion() {
    setBusy("version");
    await fetch(`/api/admin/instances/${inst.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDraft }),
    });
    setBusy(null);
    onChange();
  }
  async function updateEnv() {
    setBusy("env");
    await fetch(`/api/admin/instances/${inst.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envVars: parseEnv(envDraft) }),
    });
    setBusy(null);
    onChange();
  }
  async function fetchLogs() {
    setBusy("logs");
    const res = await fetch(`/api/admin/instances/${inst.id}/logs?lines=80`);
    const j = await res.json();
    setLogs(j.logs);
    setBusy(null);
  }
  async function destroy() {
    if (
      !confirm(
        `Destroy instance "${inst.containerName}"?\n\nThe container will be stopped and removed. Volume (and DB) is kept by default — purge it separately if needed.`
      )
    )
      return;
    setBusy("destroy");
    await fetch(`/api/admin/instances/${inst.id}`, { method: "DELETE" });
    setBusy(null);
    onChange();
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="p-5 flex items-center gap-4 cursor-pointer hover:bg-[#161b24]"
        onClick={onToggle}
      >
        <StatusDot status={inst.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            <div className="font-semibold">{inst.clientName}</div>
            <div className="text-muted text-xs">
              {inst.subdomain}.n8n.example.com
            </div>
          </div>
          <div className="text-xs text-muted font-mono mt-1">
            {inst.containerName} · {inst.image} · port {inst.port}
          </div>
        </div>
        <div className="text-xs text-muted text-right">
          <div>Updated {new Date(inst.updatedAt).toLocaleString()}</div>
          {inst.lastError && (
            <div className="text-red-400 mt-1">{inst.lastError}</div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={restart} disabled={!!busy} className="btn text-sm">
              {busy === "restart" ? "Restarting..." : "Restart"}
            </button>
            <button
              onClick={() => setTab(tab === "version" ? null : "version")}
              className="btn text-sm"
            >
              Update version
            </button>
            <button
              onClick={() => setTab(tab === "env" ? null : "env")}
              className="btn text-sm"
            >
              Edit env vars
            </button>
            <button
              onClick={() => {
                setTab(tab === "logs" ? null : "logs");
                if (tab !== "logs") fetchLogs();
              }}
              className="btn text-sm"
            >
              {tab === "logs" ? "Hide logs" : "View logs"}
            </button>
            <div className="flex-1" />
            <button
              onClick={destroy}
              disabled={!!busy}
              className="btn text-sm text-red-400 hover:bg-red-950/40"
            >
              {busy === "destroy" ? "..." : "Destroy"}
            </button>
          </div>

          {tab === "version" && (
            <div className="border border-border rounded-md p-4 space-y-3">
              <div className="label">Change n8n version</div>
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={imageDraft}
                  onChange={(e) => setImageDraft(e.target.value)}
                >
                  {AVAILABLE_VERSIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  onClick={updateVersion}
                  disabled={!!busy || imageDraft === inst.image}
                  className="btn btn-primary"
                >
                  {busy === "version" ? "Updating..." : "Apply"}
                </button>
              </div>
              <div className="text-xs text-muted">
                The container will pull the new image, stop, recreate with the
                same volume, and restart. Expect ~30s downtime per instance.
              </div>
            </div>
          )}

          {tab === "env" && (
            <div className="border border-border rounded-md p-4 space-y-3">
              <div className="label">Environment variables</div>
              <textarea
                className="input w-full font-mono text-xs"
                rows={Math.max(6, envDraft.split("\n").length)}
                value={envDraft}
                onChange={(e) => setEnvDraft(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  onClick={updateEnv}
                  disabled={!!busy}
                  className="btn btn-primary"
                >
                  {busy === "env" ? "Applying..." : "Save & recreate"}
                </button>
              </div>
              <div className="text-xs text-muted">
                Docker can't mutate env vars on a running container — saving
                triggers a stop/recreate cycle (same volume).
              </div>
            </div>
          )}

          {tab === "logs" && (
            <div className="border border-border rounded-md p-3 bg-[#0b0e14]">
              <div className="flex items-center justify-between mb-2">
                <div className="label">Logs (last 80 lines)</div>
                <button
                  onClick={fetchLogs}
                  className="btn text-xs"
                  disabled={busy === "logs"}
                >
                  {busy === "logs" ? "Loading..." : "Refresh"}
                </button>
              </div>
              <pre className="text-xs font-mono overflow-x-auto max-h-96">
                {logs?.map((l) => (
                  <div
                    key={l.timestamp + l.message}
                    className={
                      l.stream === "stderr" ? "text-amber-400" : "text-emerald-200"
                    }
                  >
                    <span className="text-muted">{l.timestamp.slice(11, 19)}</span>{" "}
                    {l.message}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: InstanceRow["status"] }) {
  const map = {
    running: "bg-emerald-400",
    stopped: "bg-gray-500",
    provisioning: "bg-amber-400 animate-pulse",
    updating: "bg-blue-400 animate-pulse",
    error: "bg-red-500",
  } as const;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-2 h-2 rounded-full ${map[status]}`} />
      <span className="text-xs uppercase tracking-wide text-muted">
        {status}
      </span>
    </div>
  );
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}
