import type { MetadataRoute } from "next";

const siteUrl = "https://restroflow-joyel.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/admin",
        "/kitchen",
        "/waiter",
        "/cashier",
        "/unauthorized",
        "/menu/table",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
