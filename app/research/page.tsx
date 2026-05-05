import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import ResearchControlCenter from "@/app/research/ResearchControlCenter";
import { verifyToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Research Admin - anomalisaham",
  description: "Private research desk untuk analisa bandar, smart money, dan riwayat performa.",
};

function ResearchPageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

async function requireResearchAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    redirect("/login?redirect=/research");
  }

  const session = await verifyToken(token);

  if (!session) {
    redirect("/login?redirect=/research");
  }

  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/");
  }
}

export default async function ResearchPage() {
  await requireResearchAccess();

  return (
    <Suspense fallback={<ResearchPageFallback />}>
      <ResearchControlCenter />
    </Suspense>
  );
}
