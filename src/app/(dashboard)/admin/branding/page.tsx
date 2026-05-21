import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { settings } from "@/lib/store";
import { BrandingUI } from "./BrandingUI";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin/branding");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Branding</h1>
          <p className="text-muted text-sm">
            Used in the header, login screen and outbound emails.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Back to admin
        </Link>
      </div>
      <BrandingUI initial={settings.read().branding} />
    </div>
  );
}
