import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumb, breadcrumbNode, type Crumb } from "./breadcrumb";
import { Icon } from "./icon";
import { Footer, Header } from "./site-chrome";
import { ScrollReveal } from "./scroll-reveal";

export type LegalBlock = { heading: string; body: ReactNode };

export function createLegalMetadata({ title, description, path, keywords }: {
  title: string;
  description: string;
  path: string;
  keywords: string[];
}): Metadata {
  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: path,
      siteName: "StratVeda OS",
      title,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  };
}

export function LegalPage({ siteUrl, title, description, path, crumbName, updated, draft, blocks }: {
  siteUrl: string;
  title: string;
  description: string;
  path: string;
  crumbName: string;
  updated: string;
  draft?: string;
  blocks: LegalBlock[];
}) {
  const crumbs: Crumb[] = [{ name: "Home", href: "/" }, { name: crumbName, href: path }];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}${path}`,
        url: `${siteUrl}${path}`,
        name: title,
        description,
        inLanguage: "en",
        isPartOf: { "@id": `${siteUrl}/#website` },
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      breadcrumbNode(siteUrl, crumbs),
    ],
  };
  const headingId = `${path.replace(/[^a-z]/gi, "-")}-title`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollReveal/>
      <Header/>
      <main id="main-content">
        <section className="legal-page-section" aria-labelledby={headingId}>
          <div className="page-width">
            <div className="section-intro section-intro-centered" data-scroll-reveal>
              <Breadcrumb items={crumbs}/>
              <h1 id={headingId}>{crumbName}</h1>
              <p className="section-description">{description}</p>
            </div>
            <div className="prose-body" data-scroll-reveal>
              {draft ? <p className="prose-note">{draft}</p> : null}
              {blocks.map((block, index) => (
                <section className="prose-block" key={block.heading} aria-labelledby={`${headingId}-${index}`}>
                  <h2 id={`${headingId}-${index}`}>{block.heading}</h2>
                  {block.body}
                </section>
              ))}
            </div>
            <p className="prose-updated">Last updated: {updated}</p>
            <div className="page-actions" data-scroll-reveal>
              <div className="page-links">
                <a className="button button-primary" href="/contact">Contact us <Icon name="arrow-right" size={16}/></a>
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
