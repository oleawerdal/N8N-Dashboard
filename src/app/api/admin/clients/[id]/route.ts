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
    const body = (await req.json()) as {
      name?: string;
      tenancyMode?: "shared" | "dedicated";
    };
    if (!body.name?.trim() && !body.tenancyMode) {
      return NextResponse.json(
        { error: "nothing to update" },
        { status: 400 }
      );
    }
    if (body.name?.trim()) {
      const ok = await clients.rename(Number(id), body.name.trim());
      if (!ok)
        return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (body.tenancyMode) {
      const ok = await clients.setTenancyMode(Number(id), body.tenancyMode);
      if (!ok)
        return NextResponse.json({ error: "not found" }, { status: 404 });
    }
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
    const ok = await clients.remove(Number(id));
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
