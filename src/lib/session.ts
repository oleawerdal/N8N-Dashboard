import { cookies } from "next/headers";
import { getIronSession, SessionOptions } from "iron-session";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "client";
  clientId: number | null;
  clientRole: "viewer" | "operator" | "client_admin" | null;
};

export type Session = {
  user?: SessionUser;
  // When set, the session is impersonating `user`; `realUser` is the
  // identity to return to. /api/auth/stop-impersonating swaps back.
  realUser?: SessionUser;
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

export async function requireClientAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  // Platform admins implicitly have client_admin rights.
  if (user.role === "admin") return user;
  if (user.role === "client" && user.clientRole === "client_admin") return user;
  throw new Error("FORBIDDEN");
}
