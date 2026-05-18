import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/site-url";

// Iran Memorial — open archive, CC BY-SA 4.0
// All sitemap shards are exposed under /sitemap.xml; shard 0 includes the
// Dataset distribution endpoints (/api/v1/victims, /api/v1/public/dump) so
// Google Dataset Search and friends can crawl them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/admin/",
          "/admin",
          ...locales.map((l) => `/${l}/admin`),
        ],
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/sitemap/0.xml`,
    ],
    host: SITE_URL,
  };
}
