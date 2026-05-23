import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { settings } from "@/lib/store";
import { N8nUI } from "./N8nUI";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function N8nPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin/n8n");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");

  const n8n = (await settings.read()).n8n;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">n8n Connection</h1>
          <p className="text-muted text-sm">
            Point the dashboard at your n8n instance. The API key is stored
            server-side and never sent to the browser.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Back to admin
        </Link>
      </div>
      <N8nUI initial={n8n} />
    </div>
  );
}
