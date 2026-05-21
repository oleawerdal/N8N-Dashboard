import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings } from "@/lib/store";
import { sendMail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const me = await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as { to?: string };
    const to = body.to?.trim() || me.email;
    const cfg = settings.read();
    const result = await sendMail({
      to,
      toName: me.name,
      subject: `[${cfg.branding.brandName}] Test email`,
      body:
        `Hi ${me.name},\n\n` +
        `This is a test message from ${cfg.branding.brandName} via SMTP2Go.\n\n` +
        `If you received it, the integration is working. Sent at ` +
        new Date().toISOString(),
    });
    settings.recordMailTest(result.ok, result.ok ? null : result.error);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error });
    }
    return NextResponse.json({ ok: true, emailId: result.emailId, sentTo: to });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
