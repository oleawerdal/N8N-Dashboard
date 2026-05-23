import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings } from "@/lib/store";
import { testN8nConnection } from "@/lib/n8n";

// Tests a connection without persisting. Uses the values from the request
// when provided, otherwise falls back to the stored config (so the admin
// can re-test with the saved key without re-typing it).
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as {
      baseUrl?: string;
      apiKey?: string;
    };
    const stored = await settings.read();
    const baseUrl = body.baseUrl?.trim() || stored.n8n.baseUrl;
    const apiKey =
      body.apiKey && body.apiKey.trim()
        ? body.apiKey.trim()
        : (await settings._internalN8nKey()) || "";
    const result = await testN8nConnection(baseUrl, apiKey);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
