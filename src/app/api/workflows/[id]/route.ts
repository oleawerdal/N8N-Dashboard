import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { userCanAccessWorkflow } from "@/lib/access";
import { getWorkflow, listExecutions } from "@/lib/n8n";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await userCanAccessWorkflow(user, id))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const [wf, executions] = await Promise.all([
      getWorkflow(id),
      listExecutions(id, 25),
    ]);
    if (!wf) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ workflow: wf, executions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json(
      { error: msg },
      { status: msg === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}
