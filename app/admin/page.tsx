"use client";

import { Suspense } from "react";
import AdminControlCenter from "@/app/admin/AdminControlCenter";

function AdminPageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminPageFallback />}>
      <AdminControlCenter />
    </Suspense>
  );
}
