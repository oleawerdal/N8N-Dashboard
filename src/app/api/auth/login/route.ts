import { NextResponse } from "next/server";
import { users, verifyPassword } from "@/lib/store";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };
  if (!email || !password) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const u = users.findByEmail(email);
  if (!u || !verifyPassword(password, u.passwordHash, u.passwordSalt)) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }
  const session = await getSession();
  session.user = {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    clientId: u.clientId,
  };
  await session.save();
  return NextResponse.json({ ok: true });
}
