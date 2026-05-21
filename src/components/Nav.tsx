"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav({
  user,
  realUser,
  branding,
}: {
  user: {
    name: string;
    email: string;
    role: string;
    clientRole?: string | null;
  };
  realUser: { name: string; email: string } | null;
  branding: { brandName: string; logoUrl: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isPlatformAdmin = user.role === "admin";
  const isClientAdmin =
    user.role === "client" && user.clientRole === "client_admin";
  const tabs = [
    { href: "/", label: "Overview" },
    { href: "/workflows", label: "Workflows" },
    { href: "/errors", label: "Errors" },
    ...(isClientAdmin || (isPlatformAdmin && false)
      ? [{ href: "/team", label: "Team" }]
      : []),
    ...(isPlatformAdmin ? [{ href: "/admin", label: "Admin" }] : []),
    { href: "/account", label: "Account" },
  ];
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  async function stopImpersonating() {
    await fetch("/api/auth/stop-impersonating", { method: "POST" });
    window.location.href = "/admin";
  }
  return (
    <>
      {realUser && (
        <div className="bg-amber-500/15 border-b border-amber-700/50 text-amber-200 text-sm">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-semibold">Impersonating</span>{" "}
              <span className="truncate">
                {user.name} ({user.email})
              </span>{" "}
              <span className="text-amber-300/80">
                — real session: {realUser.name}
              </span>
            </div>
            <button
              onClick={stopImpersonating}
              className="btn text-xs shrink-0"
            >
              Return to my account
            </button>
          </div>
        </div>
      )}
      <header className="border-b border-border bg-panel sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt=""
                className="h-7 w-7 rounded object-contain bg-[#0b0e14] border border-border"
              />
            ) : null}
            <span className="font-semibold text-accent">{branding.brandName}</span>
          </Link>
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
    </>
  );
}
