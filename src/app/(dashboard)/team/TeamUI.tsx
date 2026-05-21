"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientRole = "viewer" | "operator" | "client_admin";
type Row = {
  id: number;
  email: string;
  name: string;
  clientRole: ClientRole;
  mfaEnabled: boolean;
  passkeyCount: number;
  ssoProvider: "entra" | null;
  lastLoginAt: string | null;
  isSelf: boolean;
};

export function TeamUI({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);

  async function changeRole(id: number, clientRole: ClientRole) {
    await fetch(`/api/team/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientRole }),
    });
    router.refresh();
  }
  async function remove(id: number, email: string) {
    if (!confirm(`Remove ${email}? They will lose access immediately.`)) return;
    await fetch(`/api/team/users/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function impersonate(id: number, name: string) {
    if (
      !confirm(
        `Sign in as ${name}? You'll see the dashboard exactly as they do. Your real session is preserved — use the banner at the top to return.`
      )
    )
      return;
    const res = await fetch(`/api/team/users/${id}/impersonate`, {
      method: "POST",
    });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Impersonation failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex sm:justify-end">
        <button
          className="btn btn-primary w-full sm:w-auto"
          onClick={() => setInviting(true)}
        >
          + Invite teammate
        </button>
      </div>

      {inviting && (
        <InviteForm
          onClose={() => {
            setInviting(false);
            router.refresh();
          }}
        />
      )}

      <div className="card overflow-hidden">
        <table className="data hidden sm:table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Security</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted font-mono">{u.email}</div>
                </td>
                <td>
                  <RoleSelect
                    value={u.clientRole}
                    disabled={u.isSelf}
                    onChange={(v) => changeRole(u.id, v)}
                  />
                </td>
                <td>
                  <SecurityChips
                    mfa={u.mfaEnabled}
                    passkeys={u.passkeyCount}
                    sso={u.ssoProvider}
                  />
                </td>
                <td className="text-muted text-xs">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString()
                    : "never"}
                </td>
                <td className="text-right whitespace-nowrap">
                  {!u.isSelf && (
                    <>
                      <button
                        onClick={() => impersonate(u.id, u.name)}
                        className="btn text-xs"
                      >
                        Sign in as
                      </button>
                      <button
                        onClick={() => remove(u.id, u.email)}
                        className="btn text-xs text-red-400 hover:bg-red-950/40 ml-2"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-8">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="sm:hidden">
          {initial.map((u) => (
            <div key={u.id} className="list-row">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="row-title truncate">{u.name}</div>
                  <div className="row-meta font-mono text-xs break-all">
                    {u.email}
                  </div>
                </div>
                {u.isSelf && (
                  <span className="text-[10px] uppercase text-accent tracking-wide">
                    you
                  </span>
                )}
              </div>
              <SecurityChips
                mfa={u.mfaEnabled}
                passkeys={u.passkeyCount}
                sso={u.ssoProvider}
              />
              <RoleSelect
                value={u.clientRole}
                disabled={u.isSelf}
                onChange={(v) => changeRole(u.id, v)}
              />
              <div className="row-meta text-xs">
                Last login:{" "}
                {u.lastLoginAt
                  ? new Date(u.lastLoginAt).toLocaleString()
                  : "never"}
              </div>
              {!u.isSelf && (
                <div className="flex gap-2">
                  <button
                    onClick={() => impersonate(u.id, u.name)}
                    className="btn text-xs flex-1"
                  >
                    Sign in as
                  </button>
                  <button
                    onClick={() => remove(u.id, u.email)}
                    className="btn text-xs text-red-400 hover:bg-red-950/40 flex-1"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
          {initial.length === 0 && (
            <div className="text-center text-muted py-8">No users yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: ClientRole;
  disabled?: boolean;
  onChange: (v: ClientRole) => void;
}) {
  return (
    <select
      className="input text-xs py-1"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ClientRole)}
    >
      <option value="viewer">viewer (read-only)</option>
      <option value="operator">operator (run workflows)</option>
      <option value="client_admin">client admin (manage team)</option>
    </select>
  );
}

function SecurityChips({
  mfa,
  passkeys,
  sso,
}: {
  mfa: boolean;
  passkeys: number;
  sso: "entra" | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {sso === "entra" && <Chip color="blue">Entra SSO</Chip>}
      {mfa && <Chip color="emerald">MFA</Chip>}
      {passkeys > 0 && (
        <Chip color="purple">
          {passkeys} passkey{passkeys === 1 ? "" : "s"}
        </Chip>
      )}
      {!sso && !mfa && passkeys === 0 && (
        <Chip color="amber">password only</Chip>
      )}
    </div>
  );
}

function Chip({
  color,
  children,
}: {
  color: "blue" | "emerald" | "purple" | "amber";
  children: React.ReactNode;
}) {
  const map = {
    blue: "bg-blue-950/40 text-blue-300 border-blue-800/50",
    emerald: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
    purple: "bg-purple-950/40 text-purple-300 border-purple-800/50",
    amber: "bg-amber-950/40 text-amber-300 border-amber-800/50",
  } as const;
  return (
    <span className={`px-2 py-0.5 rounded-md border ${map[color]}`}>
      {children}
    </span>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ClientRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/team/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, clientRole: role }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Failed to invite");
      return;
    }
    const j = await res.json();
    if (j.tempPassword) setTempPassword(j.tempPassword);
    else onClose();
  }

  if (tempPassword) {
    return (
      <div className="card p-4 sm:p-5 space-y-3 border-accent/40">
        <h3 className="font-semibold">Invited {email}</h3>
        <p className="text-sm text-muted">
          Email-based invitation isn't wired up yet, so copy this temporary
          password to send to them manually. They can change it after the first
          login.
        </p>
        <div className="font-mono text-base bg-[#0b0e14] border border-border rounded-md px-3 py-2 break-all">
          {tempPassword}
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 space-y-3 border-accent/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Invite teammate</h3>
        <button onClick={onClose} className="btn text-xs">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="label mb-1">Name</div>
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anna Hansen"
          />
        </div>
        <div>
          <div className="label mb-1">Email</div>
          <input
            className="input w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="anna@acme.com"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="label mb-1">Role</div>
          <select
            className="input w-full"
            value={role}
            onChange={(e) => setRole(e.target.value as ClientRole)}
          >
            <option value="viewer">viewer — read-only</option>
            <option value="operator">operator — can run workflows</option>
            <option value="client_admin">
              client admin — can manage teammates
            </option>
          </select>
        </div>
      </div>
      {err && <div className="text-sm text-red-400">{err}</div>}
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={busy || !email.trim() || !name.trim()}
          className="btn btn-primary"
        >
          {busy ? "Inviting..." : "Send invite"}
        </button>
      </div>
    </div>
  );
}
