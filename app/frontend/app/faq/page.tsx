import type { Metadata } from "next";
import { Icon } from "../../components/icon";
import { Breadcrumb, breadcrumbNode, type Crumb } from "../../components/breadcrumb";
import { FaqList, faqMainEntity } from "../../components/faq-section";
import { Footer, Header } from "../../components/site-chrome";
import { ScrollReveal } from "../../components/scroll-reveal";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const faqTitle = "FAQs | StratVeda OS";
const faqDescription =
  "Answers about StratVeda OS: what the free month covers, how a Decision Brief uses your evidence, and what the product does not guarantee.";

const faqCrumbs: Crumb[] = [{ name: "Home", href: "/" }, { name: "FAQs", href: "/faq" }];

export const metadata: Metadata = {
  title: { absolute: faqTitle },
  description: faqDescription,
  keywords: ["StratVeda OS questions", "AI decision partner FAQ", "decision brief", "free month offer", "operational success"],
  alternates: { canonical: "/faq" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/faq",
    siteName: "StratVeda OS",
    title: faqTitle,
    description: faqDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title: faqTitle,
    description: faqDescription,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/faq`,
      url: `${siteUrl}/faq`,
      name: "StratVeda OS questions and answers",
      description: faqDescription,
      inLanguage: "en",
      isPartOf: { "@id": `${siteUrl}/#website` },
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/faq#faqs`,
      mainEntity: faqMainEntity,
    },
    breadcrumbNode(siteUrl, faqCrumbs),
  ],
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollReveal/>
      <Header/>
      <main id="main-content">
        <section className="faq-page-section" aria-labelledby="faq-page-title">
          <div className="page-width">
            <div className="section-intro section-intro-centered" data-scroll-reveal>
              <Breadcrumb items={faqCrumbs}/>
              <h1 id="faq-page-title">Frequently asked questions</h1>
              <p className="section-description">What StratVeda OS does with your question, how it weighs the evidence behind a Decision Brief, and what the free month covers.</p>
            </div>
            <FaqList/>
            <div className="page-actions" data-scroll-reveal>
              <p className="page-note">Experience the full product free for one month.</p>
              <div className="page-links">
                <a className="button button-primary" href="/sign-up">Start your free month <Icon name="arrow-right" size={16}/></a>
                <a className="page-link" href="/">Back to home</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </>
  );
}
