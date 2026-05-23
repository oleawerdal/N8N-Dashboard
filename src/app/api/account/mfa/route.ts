import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/store";

// Mocked MFA enroll/disable. Real flow would generate a TOTP secret,
// show a QR, verify a 6-digit code, and store the secret server-side.
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const { action } = (await req.json()) as { action?: "enable" | "disable" };
    if (action === "enable") await users.setMfa(me.id, true);
    else if (action === "disable") await users.setMfa(me.id, false);
    else
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    return NextResponse.json({
      mfaEnabled: (await users.findById(me.id))?.mfaEnabled ?? false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json(
      { error: msg },
      { status: msg === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}
