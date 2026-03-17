import { NextRequest } from "next/server";
import { verifyToken, SessionPayload } from "@/lib/auth";

export async function requireUserSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}