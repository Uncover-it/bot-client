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
  },
};

export default nextConfig;
