import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export interface SessionPayload {
  userId: string;
  email: string;
  role: "user" | "admin" | "superadmin";
  avatarUrl?: string | null;
  membershipStatus?: string | null;
  membershipEndDate?: string | null;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
