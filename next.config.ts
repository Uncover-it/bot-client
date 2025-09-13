import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  experimental: {
    ppr: "incremental",
    serverActions: {
      bodySizeLimit: "100mb"
    }
  },
};

export default nextConfig;
