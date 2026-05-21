import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { restart } from "@/lib/docker";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { action } = (await req.json()) as { action?: string };
    if (action !== "restart") {
      return NextResponse.json(
        { error: "unsupported action" },
        { status: 400 }
      );
    }
    const inst = await restart(Number(id));
    return NextResponse.json({ instance: inst });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
