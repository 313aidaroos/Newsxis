import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, publicSiteUrl } from "@/lib/public-site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" || path === "/feed" ? "hourly" : "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
