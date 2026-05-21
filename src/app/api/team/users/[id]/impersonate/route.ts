import { NextResponse } from "next/server";
import { getSession, requireClientAdmin } from "@/lib/session";
import { users } from "@/lib/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireClientAdmin();
    const { id } = await params;
    const target = users.findById(Number(id));
    if (!target)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    if (target.role === "admin") {
      return NextResponse.json(
        { error: "cannot impersonate platform admins" },
        { status: 403 }
      );
    }
    if (me.role !== "admin" && target.clientId !== me.clientId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (target.id === me.id) {
      return NextResponse.json({ error: "already you" }, { status: 400 });
    }
    const session = await getSession();
    // Preserve the real identity so we can swap back.
    if (!session.realUser) session.realUser = session.user;
    session.user = {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
      clientId: target.clientId,
      clientRole: target.clientRole,
    };
    await session.save();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
