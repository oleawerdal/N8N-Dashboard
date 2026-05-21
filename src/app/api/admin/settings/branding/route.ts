import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings } from "@/lib/store";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      brandName?: string;
      tagline?: string;
      logoUrl?: string | null;
      primaryColor?: string;
      supportEmail?: string;
    };
    settings.updateBranding({
      ...(body.brandName !== undefined && { brandName: body.brandName }),
      ...(body.tagline !== undefined && { tagline: body.tagline }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl || null }),
      ...(body.primaryColor !== undefined && {
        primaryColor: body.primaryColor,
      }),
      ...(body.supportEmail !== undefined && {
        supportEmail: body.supportEmail,
      }),
    });
    return NextResponse.json({ branding: settings.read().branding });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
