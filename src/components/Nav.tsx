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
    <header className="border-b border-border bg-panel sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-3">
        <div className="font-semibold text-accent shrink-0">n8n Dashboard</div>
        <nav className="flex-1 flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {tabs.map((t) => {
            const active =
              t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 py-1.5 rounded-md text-sm shrink-0 ${
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
        <div className="hidden md:block text-sm text-right">
          <div>{user.name}</div>
          <div className="text-muted text-xs">{user.email}</div>
        </div>
        <button
          onClick={logout}
          className="btn text-xs shrink-0"
          aria-label="Sign out"
        >
          <span className="hidden sm:inline">Sign out</span>
          <span className="sm:hidden" aria-hidden>
            ⎋
          </span>
        </button>
      </div>
    </header>
  );
}
