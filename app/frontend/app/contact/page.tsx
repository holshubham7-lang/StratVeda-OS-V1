import type { Metadata } from "next";
import { Breadcrumb, breadcrumbNode, type Crumb } from "../../components/breadcrumb";
import { ContactForm } from "../../components/contact-form";
import { Footer, Header } from "../../components/site-chrome";
import { ScrollReveal } from "../../components/scroll-reveal";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const contactTitle = "Contact Us | StratVeda OS";
const contactDescription =
  "Contact StratVeda OS about a business decision, the free month, or your account.";

const contactCrumbs: Crumb[] = [{ name: "Home", href: "/" }, { name: "Contact us", href: "/contact" }];

export const metadata: Metadata = {
  title: { absolute: contactTitle },
  description: contactDescription,
  keywords: ["contact StratVeda OS", "AI decision partner contact", "Decision Brief enquiry", "operational success enquiry"],
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/contact",
    siteName: "StratVeda OS",
    title: contactTitle,
    description: contactDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title: contactTitle,
    description: contactDescription,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ContactPage",
      "@id": `${siteUrl}/contact`,
      url: `${siteUrl}/contact`,
      name: "Contact StratVeda OS",
      description: contactDescription,
      inLanguage: "en",
      isPartOf: { "@id": `${siteUrl}/#website` },
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "StratVeda Technologies",
      url: "https://stratvedatech.com/",
    },
    breadcrumbNode(siteUrl, contactCrumbs),
  ],
};

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollReveal/>
      <Header/>
      <main id="main-content">
        <section className="contact-page-section" aria-labelledby="contact-page-title">
          <div className="page-width">
            <div className="section-intro section-intro-centered" data-scroll-reveal>
              <Breadcrumb items={contactCrumbs}/>
              <h1 id="contact-page-title">Tell us the decision you are working through.</h1>
              <p className="section-description">Send a message about StratVeda OS, the free month, or your account. We’ll route it to the right team.</p>
            </div>
            <div className="contact-grid">
              <section className="contact-card contact-card-form" aria-labelledby="contact-form-title" data-scroll-reveal>
                <h2 id="contact-form-title">Send a message</h2>
                <ContactForm/>
              </section>
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </>
  );
}
