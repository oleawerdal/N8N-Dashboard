import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { instances } from "@/lib/store";
import { destroy, updateEnv, updateImage } from "@/lib/docker";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const instId = Number(id);
    const inst = instances.findById(instId);
    if (!inst)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    const body = (await req.json()) as {
      image?: string;
      envVars?: Record<string, string>;
    };
    let updated = inst;
    if (body.image && body.image !== inst.image) {
      updated = await updateImage(instId, body.image);
    }
    if (body.envVars) {
      updated = await updateEnv(instId, body.envVars);
    }
    return NextResponse.json({ instance: updated });
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
    await destroy(Number(id));
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
