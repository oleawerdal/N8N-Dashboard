import { NextResponse } from "next/server";
import { requireClientAdmin } from "@/lib/session";
import { users } from "@/lib/store";

export async function GET() {
  try {
    const me = await requireClientAdmin();
    // Platform admin must specify ?clientId=...; client_admin sees own tenant.
    const clientId = me.role === "admin" ? null : me.clientId;
    if (!clientId)
      return NextResponse.json(
        { error: "platform admin should use /api/admin/clients" },
        { status: 400 }
      );
    const list = users.forClient(clientId).map(scrub);
    return NextResponse.json({ users: list });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireClientAdmin();
    if (!me.clientId)
      return NextResponse.json({ error: "no tenant" }, { status: 400 });
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      clientRole?: "viewer" | "operator" | "client_admin";
    };
    if (!body.email || !body.name) {
      return NextResponse.json(
        { error: "email and name required" },
        { status: 400 }
      );
    }
    const role = body.clientRole ?? "viewer";
    const result = users.createInTenant({
      email: body.email.trim().toLowerCase(),
      name: body.name.trim(),
      clientId: me.clientId,
      clientRole: role,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({
      user: scrub(result),
      // Surface the temp password until the email-invite flow is wired.
      tempPassword:
        (result as { _tempPassword?: string })._tempPassword ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

function scrub(u: ReturnType<typeof users.findByEmail> & object) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    clientRole: u.clientRole,
    mfaEnabled: u.mfaEnabled,
    passkeyCount: u.passkeyCount,
    ssoProvider: u.ssoProvider,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "error";
  const status =
    msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}
