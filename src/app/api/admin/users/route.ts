import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { users, User } from "@/lib/store";

export async function GET() {
  try {
    await requireAdmin();
    const list = (await users.listAdmins()).map(scrub);
    return NextResponse.json({ admins: list });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }
    const result = await users.createAdmin({
      email: body.email,
      name: body.name ?? "",
      password: body.password,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ admin: scrub(result) });
  } catch (e) {
    return errorResponse(e);
  }
}

function scrub(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
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
