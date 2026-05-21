import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { settings, EMAIL_TEMPLATES } from "@/lib/store";
import { EmailsUI } from "./EmailsUI";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  const session = await getSession();
  if (!session.user) redirect("/login?next=/admin/emails");
  if (session.user.role !== "admin") redirect("/?notAdmin=1");

  const all = settings.read().emails;
  const branding = settings.read().branding;
  const mail = settings.read().mail;
  const templates = EMAIL_TEMPLATES.map((t) => ({
    key: t.key,
    label: t.label,
    sample: t.sample,
    subject: all[t.key]?.subject ?? "",
    body: all[t.key]?.body ?? "",
  }));

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Email</h1>
          <p className="text-muted text-sm">
            Provider configuration and templates for outbound mail.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-accent hover:underline">
          ← Back to admin
        </Link>
      </div>
      <EmailsUI
        templates={templates}
        brandName={branding.brandName}
        mail={mail}
      />
    </div>
  );
}
