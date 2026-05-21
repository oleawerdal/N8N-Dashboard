import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Nav } from "@/components/Nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.user) redirect("/login");
  return (
    <div className="min-h-screen">
      <Nav user={session.user} />
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {children}
      </main>
    </div>
  );
}
