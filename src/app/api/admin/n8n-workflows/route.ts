import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listAllWorkflows } from "@/lib/n8n";

// Returns every workflow visible to the n8n API key (live) or the full
// mock catalog (otherwise). Used by the admin UI to populate the
// "assign workflow to client" picker.
export async function GET() {
  try {
    await requireAdmin();
    const workflows = await listAllWorkflows();
    return NextResponse.json({ workflows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED"
        ? 401
        : msg === "FORBIDDEN"
        ? 403
        : msg.startsWith("n8n ")
        ? 502
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
