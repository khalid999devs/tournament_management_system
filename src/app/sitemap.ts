import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/env/server";

const publicPaths = [
  "/",
  "/register",
  "/schedule",
  "/rulebook",
  "/results",
  "/developers",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  return publicPaths.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
}
