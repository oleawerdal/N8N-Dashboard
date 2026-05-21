import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings } from "@/lib/store";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      provider?: "smtp2go" | "none";
      apiKey?: string; // empty string = clear; undefined = leave alone
      fromEmail?: string;
      fromName?: string;
    };
    settings.updateMail({
      provider: body.provider,
      apiKey: body.apiKey,
      fromEmail: body.fromEmail,
      fromName: body.fromName,
    });
    // Never echo the secret back.
    return NextResponse.json({ mail: settings.read().mail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
