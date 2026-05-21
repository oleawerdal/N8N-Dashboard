import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { clients, instances } from "@/lib/store";
import { DOCKER_LIVE } from "@/lib/docker";
import { InstancesUI } from "./InstancesUI";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InstancesPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin/instances");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");
  const allClients = clients.list();
  const allInstances = instances.all();

  // Clients eligible for an instance: dedicated tenancy + no instance yet.
  const eligibleClients = allClients
    .filter((c) => c.tenancyMode === "dedicated")
    .filter((c) => !allInstances.find((i) => i.clientId === c.id))
    .map((c) => ({ id: c.id, name: c.name }));

  const rows = allInstances.map((i) => {
    const client = allClients.find((c) => c.id === i.clientId);
    return {
      ...i,
      clientName: client?.name ?? "(deleted client)",
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin · n8n Instances</h1>
          <p className="text-muted">
            Dedicated n8n containers, one per customer. Provisioning, version
            upgrades, env vars, logs.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Back to clients
        </Link>
      </div>

      <div className="card p-4 text-sm flex items-center gap-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            DOCKER_LIVE ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        <span className="font-medium">
          Docker mode: {DOCKER_LIVE ? "REAL" : "MOCK"}
        </span>
        <span className="text-muted">
          {DOCKER_LIVE
            ? "Actions hit /var/run/docker.sock on the host."
            : "Demo mode: actions update in-memory state, no real containers are touched. Flip DOCKER_MODE=real after deploying to a host with Docker."}
        </span>
      </div>

      <InstancesUI initial={rows} eligibleClients={eligibleClients} />
    </div>
  );
}
