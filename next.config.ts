import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["yahoo-finance2", "@upstash/redis", "mongoose", "bcryptjs"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "akcdn.detik.net.id" },
      { protocol: "https", hostname: "cdn.detik.net.id" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
