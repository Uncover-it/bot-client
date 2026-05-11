import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://bot.uncoverit.org",
      lastModified: process.env.BUILD_DATE,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
