import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";

// Marketing routes only — accounts, auth and the signed-in app must never appear here.
const publicPaths = [
  "/",
  "/about",
  "/how-it-works",
  "/faq",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/cookie-policy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map(path => ({ url: `${siteUrl}${path}` }));
}
