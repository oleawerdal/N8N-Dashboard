import { cookies } from "next/headers";
import { getIronSession, SessionOptions } from "iron-session";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "client";
  clientId: number | null;
};

export type Session = {
  user?: SessionUser;
};

const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "dev-secret-change-me-please-32chars-min!",
  cookieName: "n8n_dash_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<Session>(cookieStore, sessionOptions);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session.user) throw new Error("UNAUTHENTICATED");
  return session.user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}
