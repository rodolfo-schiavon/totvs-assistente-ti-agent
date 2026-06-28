import { SignJWT, jwtVerify } from "jose";
import type { LegalRole } from "../core/roles";
import { normalizeRole } from "../core/roles";

export type { LegalRole };

export type JwtPayload = {
  sub: string;
  role: LegalRole;
  username?: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  const role = normalizeRole(payload.role);
  return new SignJWT({ role, username: payload.username || payload.sub })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    if (!sub) return null;
    const username = payload.username as string | undefined;
    return { sub, role: normalizeRole(payload.role as string), username };
  } catch {
    return null;
  }
}
