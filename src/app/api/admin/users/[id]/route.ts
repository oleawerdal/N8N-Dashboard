import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { users } from "@/lib/store";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAdmin();
    const { id } = await params;
    const targetId = Number(id);
    const target = await users.findById(targetId);
    if (!target || target.role !== "admin") {
      return NextResponse.json({ error: "admin not found" }, { status: 404 });
    }
    if (target.id === me.id) {
      return NextResponse.json(
        { error: "you cannot remove your own admin account" },
        { status: 400 }
      );
    }
    const ok = await users.remove(targetId);
    if (!ok) {
      return NextResponse.json(
        { error: "cannot remove the last remaining admin" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
