import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { clients } from "@/lib/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { name } = (await req.json()) as { name?: string };
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const ok = clients.rename(Number(id), name.trim());
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
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
    await requireAdmin();
    const { id } = await params;
    const ok = clients.remove(Number(id));
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
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
