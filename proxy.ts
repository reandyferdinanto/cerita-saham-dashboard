import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./lib/auth";

// Routes that require at least "user" role
const USER_ROUTES = ["/search", "/watchlist", "/guidance", "/stock"];
// Routes that require at least "admin" role
const ADMIN_ROUTES = ["/admin"];
// API routes that require at least "admin"
const ADMIN_API = ["/api/watchlist"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/pending") ||
    pathname === "/" ||
    pathname.startsWith("/api/news") ||
    pathname.startsWith("/api/stocks/quote") ||
    pathname.startsWith("/api/stocks/history") ||
    pathname.startsWith("/api/stocks/fundamental") ||
    pathname.startsWith("/api/stocks/search") ||
    pathname.startsWith("/api/admin/settings")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_token")?.value;
  const session = token ? await verifyToken(token) : null;

  // Admin API routes - POST/PUT/DELETE require admin; GET is public
  if (ADMIN_API.some((r) => pathname.startsWith(r))) {
    if (req.method !== "GET") {
      if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Admin UI pages
  if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Admin API (users management)
  if (pathname.startsWith("/api/admin")) {
    if (!session || session.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // User-level protected routes
  if (USER_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!session) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin/superadmin bypass membership check
    if (session.role === "admin" || session.role === "superadmin") {
      return NextResponse.next();
    }

    // Auto-check expiry
    const isExpired =
      session.membershipStatus === "active" &&
      session.membershipEndDate &&
      new Date(session.membershipEndDate) < new Date();

    const effectiveStatus = isExpired ? "expired" : session.membershipStatus;

    if (effectiveStatus !== "active") {
      return NextResponse.redirect(new URL("/pending", req.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo-CS.png|.*\\.svg|.*\\.png|.*\\.jpg).*)",
  ],
};
