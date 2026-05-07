import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      { hostname: "*.discordapp.com" },
      { hostname: "*.discordapp.net" },
      { hostname: "cdn.discordapp.com" },
      { hostname: "media.discordapp.net" },
      { hostname: "i.scdn.co" },
      { hostname: "i.ytimg.com" },
      { hostname: "static-cdn.jtvnw.net" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
