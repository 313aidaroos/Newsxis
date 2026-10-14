import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/public-site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/settings", "/billing", "/onboarding", "/post"],
    },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  };
}
