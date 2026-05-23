import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settings, Settings } from "@/lib/store";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as Partial<Settings["auth"]> & {
      entraSecret?: string;
    };
    const current = (await settings.read()).auth;
    const next: Settings["auth"] = {
      emailPassword: body.emailPassword ?? current.emailPassword,
      entra: body.entra
        ? {
            ...current.entra,
            ...body.entra,
            clientSecretSet:
              body.entraSecret && body.entraSecret.length > 0
                ? true
                : current.entra.clientSecretSet,
          }
        : current.entra,
      mfa: body.mfa ?? current.mfa,
      passkeys: body.passkeys ?? current.passkeys,
    };
    await settings.updateAuth(next);
    return NextResponse.json({ auth: redact((await settings.read()).auth) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status =
      msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

function redact(a: Settings["auth"]) {
  return { ...a, entra: { ...a.entra } };
}
