"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Workflow = {
  id: number;
  n8nWorkflowId: string;
  displayName: string | null;
};
type Client = {
  id: number;
  name: string;
  createdAt: string;
  workflows: Workflow[];
};

export function AdminUI({ initial }: { initial: Client[] }) {
  const router = useRouter();
  const [newClient, setNewClient] = useState("");
  const [adds, setAdds] = useState<Record<number, { id: string; name: string }>>(
    {}
  );

  async function createClient() {
    if (!newClient.trim()) return;
    await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClient.trim() }),
    });
    setNewClient("");
    router.refresh();
  }

  async function addWorkflow(clientId: number) {
    const draft = adds[clientId];
    if (!draft?.id) return;
    await fetch(`/api/admin/clients/${clientId}/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        n8nWorkflowId: draft.id.trim(),
        displayName: draft.name?.trim() || undefined,
      }),
    });
    setAdds((s) => ({ ...s, [clientId]: { id: "", name: "" } }));
    router.refresh();
  }

  async function removeWorkflow(clientId: number, workflowId: string) {
    await fetch(
      `/api/admin/clients/${clientId}/workflows?workflowId=${encodeURIComponent(workflowId)}`,
      { method: "DELETE" }
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 flex items-end gap-3">
        <div className="flex-1">
          <div className="label mb-1">New client name</div>
          <input
            className="input w-full"
            value={newClient}
            onChange={(e) => setNewClient(e.target.value)}
            placeholder="e.g. Initech"
          />
        </div>
        <button onClick={createClient} className="btn btn-primary">
          Add client
        </button>
      </div>

      {initial.map((c) => {
        const draft = adds[c.id] || { id: "", name: "" };
        return (
          <div key={c.id} className="card p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <h3 className="text-lg font-semibold">{c.name}</h3>
                <div className="text-xs text-muted">Client #{c.id}</div>
              </div>
              <div className="text-sm text-muted">
                {c.workflows.length} workflow
                {c.workflows.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="data">
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
                      <td>{w.displayName || <span className="text-muted">—</span>}</td>
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
                  <tr>
                    <td>
                      <input
                        className="input w-full text-sm"
                        placeholder="wf_..."
                        value={draft.id}
                        onChange={(e) =>
                          setAdds((s) => ({
                            ...s,
                            [c.id]: { ...draft, id: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input w-full text-sm"
                        placeholder="Optional display name"
                        value={draft.name}
                        onChange={(e) =>
                          setAdds((s) => ({
                            ...s,
                            [c.id]: { ...draft, name: e.target.value },
                          }))
                        }
                      />
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => addWorkflow(c.id)}
                        className="btn btn-primary text-xs"
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
