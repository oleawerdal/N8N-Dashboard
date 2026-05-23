import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { settings } from "@/lib/store";
import { Nav } from "@/components/Nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.user) redirect("/login");
  const branding = (await settings.read()).branding;
  return (
    <div
      className="min-h-screen"
      style={
        {
          // CSS variable so utility classes can reference brand color too
          "--brand": branding.primaryColor,
        } as React.CSSProperties
      }
    >
      <Nav
        user={session.user}
        realUser={
          session.realUser
            ? { name: session.realUser.name, email: session.realUser.email }
            : null
        }
        branding={{
          brandName: branding.brandName,
          logoUrl: branding.logoUrl,
        }}
      />
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
