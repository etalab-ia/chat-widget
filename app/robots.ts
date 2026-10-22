import type { MetadataRoute } from "next";

/** The widget is an internal surface: keep it out of search indexes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
