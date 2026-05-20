"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("acme@dashboard.local");
  const [password, setPassword] = useState("acme123");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || "Login failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-xl font-semibold mb-1">n8n Client Dashboard</h1>
        <p className="text-muted text-sm mb-6">Sign in to continue</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <div className="label mb-1">Email</div>
            <input
              className="input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <div className="label mb-1">Password</div>
            <input
              className="input w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {err && (
            <div className="text-sm text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full justify-center"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <div className="mt-6 text-xs text-muted border-t border-border pt-4">
          <div className="font-medium mb-2 text-white">Demo accounts</div>
          <ul className="space-y-1">
            <li>admin@dashboard.local / admin123 — Admin (sees all)</li>
            <li>acme@dashboard.local / acme123 — Acme Corp</li>
            <li>globex@dashboard.local / globex123 — Globex Industries</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
