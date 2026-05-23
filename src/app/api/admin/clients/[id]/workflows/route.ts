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
    const { n8nWorkflowId, displayName, webhookUrl } = (await req.json()) as {
      n8nWorkflowId?: string;
      displayName?: string;
      webhookUrl?: string;
    };
    if (!n8nWorkflowId) {
      return NextResponse.json(
        { error: "n8nWorkflowId required" },
        { status: 400 }
      );
    }
    await mappings.create(
      clientId,
      n8nWorkflowId,
      displayName?.trim() || null,
      webhookUrl?.trim() || null
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const clientId = Number(id);
    const { n8nWorkflowId, displayName, webhookUrl } = (await req.json()) as {
      n8nWorkflowId?: string;
      displayName?: string | null;
      webhookUrl?: string | null;
    };
    if (!n8nWorkflowId) {
      return NextResponse.json(
        { error: "n8nWorkflowId required" },
        { status: 400 }
      );
    }
    const updated = await mappings.update(clientId, n8nWorkflowId, {
      ...(displayName !== undefined && {
        displayName: displayName?.trim() || null,
      }),
      ...(webhookUrl !== undefined && {
        webhookUrl: webhookUrl?.trim() || null,
      }),
    });
    if (!updated) {
      return NextResponse.json(
        { error: "workflow not assigned to this client" },
        { status: 404 }
      );
    }
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
    await mappings.remove(clientId, wf);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
