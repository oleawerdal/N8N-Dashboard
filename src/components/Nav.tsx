"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = [
    { href: "/", label: "Overview" },
    { href: "/workflows", label: "Workflows" },
    { href: "/errors", label: "Errors" },
    ...(user.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <header className="border-b border-border bg-panel">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="font-semibold text-accent">n8n Dashboard</div>
          <nav className="flex items-center gap-1">
            {tabs.map((t) => {
              const active =
                t.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    active
                      ? "bg-[#1c222d] text-white"
                      : "text-muted hover:text-white"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <div>{user.name}</div>
            <div className="text-muted text-xs">{user.email}</div>
          </div>
          <button onClick={logout} className="btn text-xs">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
