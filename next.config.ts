import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { hostname: "*.discordapp.com" },
      { hostname: "*.discordapp.net" },
      { hostname: "cdn.discordapp.com" },
      { hostname: "media.discordapp.net" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
