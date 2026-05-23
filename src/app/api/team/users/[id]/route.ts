import { NextResponse } from "next/server";
import { requireClientAdmin } from "@/lib/session";
import { users } from "@/lib/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireClientAdmin();
    const { id } = await params;
    const target = await users.findById(Number(id));
    if (!target)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    if (me.role !== "admin" && target.clientId !== me.clientId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (target.role !== "client")
      return NextResponse.json(
        { error: "cannot modify platform admins from /team" },
        { status: 400 }
      );
    const body = (await req.json()) as {
      clientRole?: "viewer" | "operator" | "client_admin";
    };
    if (body.clientRole) await users.updateClientRole(target.id, body.clientRole);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireClientAdmin();
    const { id } = await params;
    const target = await users.findById(Number(id));
    if (!target)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    if (me.role !== "admin" && target.clientId !== me.clientId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (target.id === me.id) {
      return NextResponse.json(
        { error: "cannot delete yourself" },
        { status: 400 }
      );
    }
    await users.remove(target.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "error";
  const status =
    msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}
