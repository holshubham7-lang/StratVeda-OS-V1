import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/welcome",
        "/business-fingerprint",
        "/strategic-context",
        "/evidence-library",
        "/decision-profile",
        "/decision-center",
        "/decision-workspace",
        "/executive-brief",
        "/chat",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
