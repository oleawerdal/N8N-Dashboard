import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session.realUser) {
    return NextResponse.json(
      { error: "not impersonating" },
      { status: 400 }
    );
  }
  session.user = session.realUser;
  delete session.realUser;
  await session.save();
  return NextResponse.json({ ok: true });
}
