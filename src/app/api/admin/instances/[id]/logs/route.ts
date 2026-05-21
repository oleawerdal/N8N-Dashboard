import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { tailLogs } from "@/lib/docker";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const url = new URL(req.url);
    const lines = Number(url.searchParams.get("lines") ?? "100");
    const logs = await tailLogs(Number(id), lines);
    return NextResponse.json({ logs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
