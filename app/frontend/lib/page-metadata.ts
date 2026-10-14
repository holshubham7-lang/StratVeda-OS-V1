import type { Metadata } from "next";

// Every route using this is noindex,nofollow, so it must not advertise a canonical either.
export function createPageMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "en_IN",
      siteName: "StratVeda OS",
      title: `${title} | StratVeda OS`,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | StratVeda OS`,
      description,
      images: ["/opengraph-image"],
    },
  };
}
