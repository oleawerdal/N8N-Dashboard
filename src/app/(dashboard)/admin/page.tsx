import { requireAdmin } from "@/lib/session";
import { clients, mappings, users } from "@/lib/store";
import { N8N_LIVE, _mock } from "@/lib/n8n";
import { AdminUI } from "./AdminUI";

export const dynamic = "force-dynamic";

async function listAllN8nWorkflows(): Promise<
  { id: string; name: string; active: boolean }[]
> {
  if (!N8N_LIVE) {
    return _mock.workflows.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
    }));
  }
  const base = process.env.N8N_BASE_URL?.replace(/\/$/, "") || "";
  const key = process.env.N8N_API_KEY || "";
  try {
    const res = await fetch(`${base}/api/v1/workflows?limit=250`, {
      headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      data: Array<{ id: string; name: string; active: boolean }>;
    };
    return body.data.map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
    }));
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  await requireAdmin();
  const allClients = clients.list();
  const allMaps = mappings.all();
  const allWorkflows = await listAllN8nWorkflows();

  const data = allClients.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    workflows: allMaps
      .filter((m) => m.clientId === c.id)
      .map((m) => ({
        id: m.id,
        n8nWorkflowId: m.n8nWorkflowId,
        displayName: m.displayName,
      })),
    users: users.forClient(c.id).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      clientRole: (u.clientRole ?? "viewer") as "viewer" | "operator",
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin · Clients & access</h1>
        <p className="text-muted">
          Pick which n8n workflows each client can see, and set per-user roles.
        </p>
      </div>
      <AdminUI initial={data} availableWorkflows={allWorkflows} />
    </div>
  );
}
