import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("max");

  return [
    {
      url: "https://bot.uncoverit.org",
      lastModified: process.env.BUILD_DATE,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
