import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { workflowsForUser } from "@/lib/access";
import { errors } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireUser();
    const allowed = workflowsForUser(user).map((r) => r.n8nWorkflowId);
    return NextResponse.json({
      errors: errors.recentForWorkflows(allowed, 100),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json(
      { error: msg },
      { status: msg === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  // Public endpoint for n8n's Error Workflow to POST into.
  // Expects: { workflowId, workflowName?, executionId?, nodeName?, message? }
  // Protect with a shared secret header in production.
  const body = (await req.json()) as Record<string, string | undefined>;
  if (!body.workflowId) {
    return NextResponse.json({ error: "workflowId required" }, { status: 400 });
  }
  errors.create({
    n8nWorkflowId: body.workflowId,
    workflowName: body.workflowName,
    executionId: body.executionId,
    nodeName: body.nodeName,
    message: body.message,
  });
  return NextResponse.json({ ok: true });
}
