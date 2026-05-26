import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    webpackBuildWorker: false,
  },
  serverExternalPackages: ["yahoo-finance2", "@upstash/redis", "mongoose", "bcryptjs"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "akcdn.detik.net.id" },
      { protocol: "https", hostname: "cdn.detik.net.id" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "static1.squarespace.com" },
      { protocol: "https", hostname: "images.squarespace-cdn.com" },
    ],
  },
};

export default nextConfig;
