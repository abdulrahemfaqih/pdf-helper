import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { TOOLS_CONFIG } from "@/lib/tools-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...TOOLS_CONFIG.map((tool) => ({
      url: `${SITE_URL}${tool.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
