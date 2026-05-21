import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { users } from "@/lib/store";

// Mocked passkey register/remove. Real flow uses navigator.credentials
// + a WebAuthn challenge round-trip (e.g. via @simplewebauthn/server).
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const { action } = (await req.json()) as {
      action?: "register" | "removeAll";
    };
    if (action === "register") users.registerPasskey(me.id);
    else if (action === "removeAll") users.removePasskeys(me.id);
    else
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    return NextResponse.json({
      passkeyCount: users.findById(me.id)?.passkeyCount ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json(
      { error: msg },
      { status: msg === "UNAUTHENTICATED" ? 401 : 500 }
    );
  }
}
