import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { clients, mappings } from "@/lib/store";

export async function GET() {
  try {
    await requireAdmin();
    const all = await clients.list();
    const allMappings = await mappings.all();
    return NextResponse.json({
      clients: all.map((c) => ({
        ...c,
        workflows: allMappings.filter((m) => m.clientId === c.id),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { name, tenancyMode } = (await req.json()) as {
      name?: string;
      tenancyMode?: "shared" | "dedicated";
    };
    if (!name) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const c = await clients.create(name, tenancyMode ?? "shared");
    return NextResponse.json({ id: c.id, tenancyMode: c.tenancyMode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
