import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { clients, instances, mappings, users } from "@/lib/store";
import { N8N_LIVE, _mock } from "@/lib/n8n";
import { AdminUI } from "./AdminUI";
import Link from "next/link";

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
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");
  const allClients = clients.list();
  const allMaps = mappings.all();
  const allWorkflows = await listAllN8nWorkflows();

  const data = allClients.map((c) => {
    const inst = instances.forClient(c.id);
    return {
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      tenancyMode: c.tenancyMode,
      instance: inst
        ? {
            id: inst.id,
            subdomain: inst.subdomain,
            image: inst.image,
            status: inst.status,
          }
        : null,
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
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">
            Admin · Clients
          </h1>
          <p className="text-muted text-sm">
            Pick tenancy, assign workflows, manage per-user roles.
          </p>
        </div>
        <Link href="/admin/instances" className="btn text-sm self-start">
          n8n Instances →
        </Link>
      </div>
      <AdminUI initial={data} availableWorkflows={allWorkflows} />
    </div>
  );
}
