"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunButton({ workflowId }: { workflowId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/workflows/${workflowId}/run`, {
      method: "POST",
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.error || "Run failed");
      return;
    }
    setMsg("Run started.");
    setTimeout(() => router.refresh(), 800);
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={run} disabled={busy} className="btn btn-primary">
        {busy ? "Starting..." : "Run now"}
      </button>
      {msg && <div className="text-xs text-muted">{msg}</div>}
    </div>
  );
}
