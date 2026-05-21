import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings } from "@/lib/store";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      key?: string;
      subject?: string;
      body?: string;
    };
    if (!body.key || typeof body.subject !== "string" || typeof body.body !== "string") {
      return NextResponse.json(
        { error: "key, subject and body are required" },
        { status: 400 }
      );
    }
    const ok = settings.updateEmail(body.key, {
      subject: body.subject,
      body: body.body,
    });
    if (!ok)
      return NextResponse.json(
        { error: "unknown template" },
        { status: 404 }
      );
    return NextResponse.json({
      template: settings.read().emails[body.key],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
