import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { userCanAccessWorkflow } from "@/lib/access";
import { runWorkflow } from "@/lib/n8n";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!userCanAccessWorkflow(user, id)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const result = await runWorkflow(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json(
      { error: msg },
      { status: msg === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}
