import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { N8N_LIVE, _mock } from "@/lib/n8n";

// Returns every workflow visible to the n8n API key (live) or the full
// mock catalog (otherwise). Used by the admin UI to populate the
// "assign workflow to client" picker.
export async function GET() {
  try {
    await requireAdmin();
    if (!N8N_LIVE) {
      return NextResponse.json({
        workflows: _mock.workflows.map((w) => ({
          id: w.id,
          name: w.name,
          active: w.active,
        })),
      });
    }
    const base = process.env.N8N_BASE_URL?.replace(/\/$/, "") || "";
    const key = process.env.N8N_API_KEY || "";
    const res = await fetch(`${base}/api/v1/workflows?limit=250`, {
      headers: { "X-N8N-API-KEY": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `n8n ${res.status}: ${await res.text()}` },
        { status: 502 }
      );
    }
    const body = (await res.json()) as {
      data: Array<{ id: string; name: string; active: boolean }>;
    };
    return NextResponse.json({
      workflows: body.data.map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
