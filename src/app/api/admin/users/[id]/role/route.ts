import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { users } from "@/lib/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { clientRole } = (await req.json()) as {
      clientRole?: "viewer" | "operator" | "client_admin";
    };
    if (
      clientRole !== "viewer" &&
      clientRole !== "operator" &&
      clientRole !== "client_admin"
    ) {
      return NextResponse.json(
        { error: "clientRole must be viewer, operator or client_admin" },
        { status: 400 }
      );
    }
    const ok = users.updateClientRole(Number(id), clientRole);
    if (!ok)
      return NextResponse.json(
        { error: "user not found or not a client user" },
        { status: 404 }
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
