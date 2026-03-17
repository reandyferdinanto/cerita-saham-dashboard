import { NextRequest } from "next/server";
import { verifyToken, SessionPayload } from "@/lib/auth";

export async function requireAdminSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const session = await verifyToken(token);

  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return null;
  }

  return session;
}
