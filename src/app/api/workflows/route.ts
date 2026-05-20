import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { workflowsForUser } from "@/lib/access";
import { listWorkflows } from "@/lib/n8n";

export async function GET() {
  try {
    const user = await requireUser();
    const rows = workflowsForUser(user);
    const ids = [...new Set(rows.map((r) => r.n8nWorkflowId))];
    const wfs = await listWorkflows(ids);
    const overrides = new Map(
      rows.map((r) => [r.n8nWorkflowId, r.displayName])
    );
    return NextResponse.json({
      workflows: wfs.map((w) => ({
        ...w,
        displayName: overrides.get(w.id) || w.name,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json(
      { error: msg },
      { status: msg === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}
