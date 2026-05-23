"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type N8nSettings = {
  mode: "mock" | "live";
  baseUrl: string;
  apiKeySet: boolean;
};

export function N8nUI({ initial }: { initial: N8nSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState<N8nSettings["mode"]>(initial.mode);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(initial.apiKeySet);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState<
    { ok: boolean; text: string } | null
  >(null);

  async function save() {
    setBusy("save");
    setMsg(null);
    const res = await fetch("/api/admin/settings/n8n", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        baseUrl,
        // Only send the key when the admin actually typed one.
        ...(apiKey.trim() ? { apiKey } : {}),
      }),
    });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: j.error || "Failed to save" });
      return;
    }
    setKeySet(j.n8n?.apiKeySet ?? keySet);
    setApiKey("");
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    const res = await fetch("/api/admin/settings/n8n/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        ...(apiKey.trim() ? { apiKey } : {}),
      }),
    });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    if (j.ok) {
      setMsg({
        ok: true,
        text: `Connected — n8n returned ${j.count} workflow(s).`,
      });
    } else {
      setMsg({ ok: false, text: j.error || "Connection failed" });
    }
  }

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div>
        <div className="label mb-1">Mode</div>
        <select
          className="input w-full"
          value={mode}
          onChange={(e) => setMode(e.target.value as N8nSettings["mode"])}
        >
          <option value="mock">mock — built-in demo data</option>
          <option value="live">live — call my n8n instance</option>
        </select>
      </div>

      <div className={mode === "live" ? "space-y-4" : "space-y-4 opacity-50"}>
        <div>
          <div className="label mb-1">Base URL</div>
          <input
            className="input w-full"
            value={baseUrl}
            disabled={mode !== "live"}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://n8n.yourdomain.com"
          />
          <div className="text-xs text-muted mt-1">
            Your n8n root URL (no trailing slash). The dashboard calls{" "}
            <code>/api/v1</code> under it.
          </div>
        </div>
        <div>
          <div className="label mb-1">
            API key{" "}
            {keySet && (
              <span className="text-emerald-400 text-xs">· a key is set</span>
            )}
          </div>
          <input
            className="input w-full font-mono"
            type="password"
            value={apiKey}
            disabled={mode !== "live"}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keySet ? "•••••••• (leave blank to keep current)" : "n8n API key"}
          />
          <div className="text-xs text-muted mt-1">
            Create one in n8n under Settings → API. Stored server-side only.
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`text-sm rounded-md px-3 py-2 border ${
            msg.ok
              ? "text-emerald-300 bg-emerald-950/30 border-emerald-900/50"
              : "text-red-400 bg-red-950/30 border-red-900/50"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
        <button
          onClick={test}
          disabled={!!busy || mode !== "live"}
          className="btn"
        >
          {busy === "test" ? "Testing..." : "Test connection"}
        </button>
        <button
          onClick={save}
          disabled={!!busy}
          className="btn btn-primary"
        >
          {busy === "save" ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
