"use client";

import { Suspense } from "react";
import AdminUsersPageContent from "./AdminUsersPageContent";

function AdminUsersPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminUsersPageFallback />}>
      <AdminUsersPageContent />
    </Suspense>
  );
}
