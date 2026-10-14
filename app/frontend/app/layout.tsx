import type { Metadata } from "next";
import Script from "next/script";
import { FlashNoticeToast } from "../components/feedback-toast";
import { OnboardingRouteTransition } from "../components/onboarding-route-transition";
import "./globals.css";

const siteDescription =
  "Bring a real business question to StratVeda OS. Examine the evidence and alternatives, and get a focused Decision Brief with a practical next step.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com"),
  title: {
    default: "StratVeda OS — Operational Success",
    template: "%s | StratVeda OS",
  },
  applicationName: "StratVeda OS",
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "StratVeda OS",
    title: "StratVeda OS — Operational Success",
    description: siteDescription,
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StratVeda OS — Operational Success",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="motion-preference" strategy="beforeInteractive">
          {`if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) { document.documentElement.classList.add('motion-ready'); }`}
        </Script>
      </head>
      <body>
        {children}
        <OnboardingRouteTransition />
        <FlashNoticeToast />
      </body>
    </html>
  );
}
