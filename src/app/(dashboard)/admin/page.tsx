import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { clients, instances, mappings, users } from "@/lib/store";
import { listAllWorkflows } from "@/lib/n8n";
import { AdminUI } from "./AdminUI";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");
  const allClients = await clients.list();
  const allMaps = await mappings.all();
  const allWorkflows = await listAllWorkflows().catch(() => []);

  const data = await Promise.all(
    allClients.map(async (c) => {
      const inst = await instances.forClient(c.id);
      const clientUsers = await users.forClient(c.id);
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
        users: clientUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          clientRole: (u.clientRole ?? "viewer") as "viewer" | "operator",
        })),
      };
    })
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Admin</h1>
        <p className="text-muted text-sm">
          Platform-level settings and tenant management.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <AdminTile href="/admin/admins" label="Admins" />
        <AdminTile href="/admin/n8n" label="n8n Connection" />
        <AdminTile href="/admin/instances" label="n8n Instances" />
        <AdminTile href="/admin/branding" label="Branding" />
        <AdminTile href="/admin/auth" label="Authentication" />
        <AdminTile href="/admin/emails" label="Email templates" />
      </div>

      <div className="pt-2 sm:pt-4">
        <h2 className="text-lg font-medium mb-3">Clients</h2>
        <AdminUI initial={data} availableWorkflows={allWorkflows} />
      </div>
    </div>
  );
}

function AdminTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="card p-3 sm:p-4 hover:bg-[#161b24] flex items-center justify-between text-sm font-medium"
    >
      {label}
      <span className="text-muted">→</span>
    </Link>
  );
}
