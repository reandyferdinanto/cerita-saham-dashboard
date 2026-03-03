import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["yahoo-finance2"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "akcdn.detik.net.id" },
      { protocol: "https", hostname: "cdn.detik.net.id" },
    ],
  },
};

export default nextConfig;
