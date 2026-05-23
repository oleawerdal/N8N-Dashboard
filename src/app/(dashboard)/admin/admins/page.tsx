import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { users } from "@/lib/store";
import { AdminsUI } from "./AdminsUI";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin/admins");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");

  const list = (await users.listAdmins()).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    mfaEnabled: u.mfaEnabled,
    passkeyCount: u.passkeyCount,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    isSelf: u.id === session.user!.id,
  }));

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Admins</h1>
          <p className="text-muted text-sm">
            Platform administrators. They can manage every tenant, instance
            and setting.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Back to admin
        </Link>
      </div>
      <AdminsUI initial={list} />
    </div>
  );
}
