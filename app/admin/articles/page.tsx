"use client";

import { Suspense } from "react";
import AdminArticlesPageContent from "./AdminArticlesPageContent";

function AdminArticlesPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function AdminArticlesPage() {
  return (
    <Suspense fallback={<AdminArticlesPageFallback />}>
      <AdminArticlesPageContent />
    </Suspense>
  );
}
