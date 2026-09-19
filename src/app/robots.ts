import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env/server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/operator", "/staff", "/api", "/auth", "/dev"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
