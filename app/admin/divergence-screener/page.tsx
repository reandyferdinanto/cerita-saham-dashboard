import { Suspense } from "react";
import AdminDivergenceScreener from "./AdminDivergenceScreener";

export const metadata = {
  title: "Divergence Screener | Admin",
  description: "Real-time RSI and MACD divergence detection across the market",
};

export default function DivergenceScreenerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f0d] via-[#0d1410] to-[#0a0f0d] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            </div>
          }
        >
          <AdminDivergenceScreener />
        </Suspense>
      </div>
    </div>
  );
}

// Made with Bob
