import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings } from "@/lib/store";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      mode?: "mock" | "live";
      baseUrl?: string;
      apiKey?: string; // omit/undefined to leave the stored key unchanged
    };
    if (body.mode !== undefined && body.mode !== "mock" && body.mode !== "live") {
      return NextResponse.json(
        { error: "mode must be 'mock' or 'live'" },
        { status: 400 }
      );
    }
    if (body.mode === "live") {
      const baseUrl =
        body.baseUrl ?? (await settings.read()).n8n.baseUrl;
      if (!baseUrl?.trim()) {
        return NextResponse.json(
          { error: "Base URL is required for live mode" },
          { status: 400 }
        );
      }
    }
    await settings.updateN8n({
      mode: body.mode,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    });
    // Never echo the key back.
    return NextResponse.json({ n8n: (await settings.read()).n8n });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
