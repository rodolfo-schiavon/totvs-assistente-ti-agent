import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { LegalRole } from "@/lib/roles";
import { normalizeRole } from "@/lib/roles";

export const SESSION_COOKIE = "law_session";

export type { LegalRole };

export type SessionUser = {
  userId: string;
  username: string;
  role: LegalRole;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const role = normalizeRole(user.role);
  return new SignJWT({ role, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secretKey());
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    if (!sub) return null;
    const username = (payload.username as string) || sub;
    return { userId: sub, username: String(username), role: normalizeRole(payload.role as string) };
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getSession()) !== null;
}
