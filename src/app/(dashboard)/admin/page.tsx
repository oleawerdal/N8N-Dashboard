import { requireAdmin } from "@/lib/session";
import { clients, mappings } from "@/lib/store";
import { AdminUI } from "./AdminUI";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const allClients = clients.list();
  const allMaps = mappings.all();

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
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin · Clients & workflow mapping</h1>
        <p className="text-muted">
          Each client sees only the n8n workflow IDs you assign here.
        </p>
      </div>
      <AdminUI initial={data} />
    </div>
  );
}
