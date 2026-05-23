"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = {
  id: number;
  email: string;
  name: string;
  mfaEnabled: boolean;
  passkeyCount: number;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
};

export function AdminsUI({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  async function remove(id: number, email: string) {
    if (
      !confirm(`Remove admin ${email}? They will lose access immediately.`)
    )
      return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to remove admin");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex sm:justify-end">
        <button
          className="btn btn-primary w-full sm:w-auto"
          onClick={() => setAdding(true)}
        >
          + Add admin
        </button>
      </div>

      {adding && (
        <AddAdminForm
          onClose={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      <div className="card overflow-hidden">
        <table className="data hidden sm:table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Security</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="font-medium">
                    {u.name}
                    {u.isSelf && (
                      <span className="ml-2 text-[10px] uppercase text-accent tracking-wide">
                        you
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted font-mono">{u.email}</div>
                </td>
                <td>
                  <SecurityChips mfa={u.mfaEnabled} passkeys={u.passkeyCount} />
                </td>
                <td className="text-muted text-xs">
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString()
                    : "never"}
                </td>
                <td className="text-right whitespace-nowrap">
                  {!u.isSelf && (
                    <button
                      onClick={() => remove(u.id, u.email)}
                      className="btn text-xs text-red-400 hover:bg-red-950/40"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-8">
                  No admins yet.
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
              <SecurityChips mfa={u.mfaEnabled} passkeys={u.passkeyCount} />
              <div className="row-meta text-xs">
                Last login:{" "}
                {u.lastLoginAt
                  ? new Date(u.lastLoginAt).toLocaleString()
                  : "never"}
              </div>
              {!u.isSelf && (
                <button
                  onClick={() => remove(u.id, u.email)}
                  className="btn text-xs text-red-400 hover:bg-red-950/40 w-full"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {initial.length === 0 && (
            <div className="text-center text-muted py-8">No admins yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityChips({ mfa, passkeys }: { mfa: boolean; passkeys: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {mfa && <Chip color="emerald">MFA</Chip>}
      {passkeys > 0 && (
        <Chip color="purple">
          {passkeys} passkey{passkeys === 1 ? "" : "s"}
        </Chip>
      )}
      {!mfa && passkeys === 0 && <Chip color="amber">password only</Chip>}
    </div>
  );
}

function Chip({
  color,
  children,
}: {
  color: "emerald" | "purple" | "amber";
  children: React.ReactNode;
}) {
  const map = {
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

function AddAdminForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Failed to add admin");
      return;
    }
    onClose();
  }

  return (
    <div className="card p-4 sm:p-5 space-y-3 border-accent/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Add admin</h3>
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
            placeholder="Ole Werdal"
          />
        </div>
        <div>
          <div className="label mb-1">Email</div>
          <input
            className="input w-full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ole@yourdomain.com"
          />
        </div>
        <div className="sm:col-span-2">
          <div className="label mb-1">Password</div>
          <input
            className="input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
          />
          <div className="text-xs text-muted mt-1">
            Share it securely. The new admin can change it under Account once
            signed in.
          </div>
        </div>
      </div>
      {err && <div className="text-sm text-red-400">{err}</div>}
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={busy || !email.trim() || password.length < 8}
          className="btn btn-primary"
        >
          {busy ? "Adding..." : "Add admin"}
        </button>
      </div>
    </div>
  );
}
