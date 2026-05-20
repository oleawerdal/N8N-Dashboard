import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { mappings } from "@/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const clientId = Number(id);
    const { n8nWorkflowId, displayName } = (await req.json()) as {
      n8nWorkflowId?: string;
      displayName?: string;
    };
    if (!n8nWorkflowId) {
      return NextResponse.json(
        { error: "n8nWorkflowId required" },
        { status: 400 }
      );
    }
    mappings.create(clientId, n8nWorkflowId, displayName ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const clientId = Number(id);
    const url = new URL(req.url);
    const wf = url.searchParams.get("workflowId");
    if (!wf) {
      return NextResponse.json(
        { error: "workflowId required" },
        { status: 400 }
      );
    }
    mappings.remove(clientId, wf);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
