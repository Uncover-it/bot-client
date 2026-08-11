import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Auto-memoizes components and hooks, so the hand-rolled useMemo/useCallback
  // in the message tree stops being the only thing keeping re-renders down.
  reactCompiler: true,
  env: {
    BUILD_DATE: new Date().toISOString(),
  },
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
    useOffline: true,
  },
};

export default withBotId(nextConfig);
