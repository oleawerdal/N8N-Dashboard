import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { clients, users } from "@/lib/store";
import { TeamUI } from "./TeamUI";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/team");
  const me = session.user;
  const allowed =
    me.role === "admin" ||
    (me.role === "client" && me.clientRole === "client_admin");
  if (!allowed) redirect("/?notTeamAdmin=1");

  // Platform admin without a clientId can't pick a tenant here.
  if (me.role === "admin" && !me.clientId) {
    redirect("/admin");
  }

  const clientId = me.clientId!;
  const tenant = clients.findById(clientId);
  const list = users.forClient(clientId).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    clientRole: (u.clientRole ?? "viewer") as
      | "viewer"
      | "operator"
      | "client_admin",
    mfaEnabled: u.mfaEnabled,
    passkeyCount: u.passkeyCount,
    ssoProvider: u.ssoProvider,
    lastLoginAt: u.lastLoginAt,
    isSelf: u.id === me.id,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">
          Team · {tenant?.name ?? "your organization"}
        </h1>
        <p className="text-muted text-sm">
          Add and manage users in your tenant. As a client admin you can
          invite teammates, change roles, impersonate them for support, or
          remove access.
        </p>
      </div>
      <TeamUI initial={list} />
    </div>
  );
}
