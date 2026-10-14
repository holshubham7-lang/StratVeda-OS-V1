import type { Metadata } from "next";
import Image from "next/image";
import { Icon } from "../../components/icon";
import { Breadcrumb, breadcrumbNode, type Crumb } from "../../components/breadcrumb";
import { Footer, Header } from "../../components/site-chrome";
import { ScrollReveal } from "../../components/scroll-reveal";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const aboutTitle = "About Us | StratVeda OS";
const aboutDescription =
  "About StratVeda OS — decision support for founders and operating teams: one real business question, the evidence, the alternatives, and a Decision Brief.";

const aboutCrumbs: Crumb[] = [{ name: "Home", href: "/" }, { name: "About us", href: "/about" }];

type ClientLogo = { name: string; src: string };

// No client has confirmed that we may show their mark, so this stays empty and the band
// shows its honest fallback. Add files under public/assets/ and list them here to switch it on.
const clientLogos: ClientLogo[] = [];

export const metadata: Metadata = {
  title: { absolute: aboutTitle },
  description: aboutDescription,
  keywords: ["about StratVeda OS", "StratVeda Technologies", "decision brief", "operational success", "business decision support"],
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/about",
    siteName: "StratVeda OS",
    title: aboutTitle,
    description: aboutDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title: aboutTitle,
    description: aboutDescription,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${siteUrl}/about`,
      url: `${siteUrl}/about`,
      name: "About StratVeda OS",
      description: aboutDescription,
      inLanguage: "en",
      isPartOf: { "@id": `${siteUrl}/#website` },
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    breadcrumbNode(siteUrl, aboutCrumbs),
  ],
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollReveal/>
      <Header/>
      <main id="main-content">
        <section className="about-page-section" aria-labelledby="about-page-title">
          <div className="page-width">
            <div className="section-intro section-intro-centered" data-scroll-reveal>
              <Breadcrumb items={aboutCrumbs}/>
              <h1 id="about-page-title">About StratVeda OS</h1>
              <p className="section-description">Decision support for founders and operating teams — built around the question in front of you, not a dashboard of numbers you already have.</p>
            </div>

            <div className="prose-body" data-scroll-reveal>
              {/* COPY SLOTS: drafted by me from the approved home-page positioning. Replace with the user's About deck. */}
              <section className="prose-block" aria-labelledby="about-story-title">
                <h2 id="about-story-title">About us</h2>
                <p>StratVeda OS is made by StratVeda Technologies Pvt. Ltd. We work on one problem: founders and operating teams are asked to decide between things that cannot be measured cleanly, usually with incomplete information, usually in the same week as everything else.</p>
                <p>Product, engineering and operations can each report their own numbers. Choosing between a hiring request, a slipping target and a delivery problem needs those numbers read together, against the outcome you are actually aiming for. That reading is what we build.</p>
              </section>

              <div className="about-values" data-scroll-reveal>
                <section className="about-value" aria-labelledby="about-vision-title">
                  <h2 id="about-vision-title">Our vision</h2>
                  <p>Operating decisions examined rather than guessed at. We want the reasoning behind a business decision to be as reviewable as the reasoning behind a piece of code — written down, open to challenge, and useful to the person who has to carry it out.</p>
                </section>
                <section className="about-value" aria-labelledby="about-mission-title">
                  <h2 id="about-mission-title">Our mission</h2>
                  <p>One real question, worked through properly. Take the question someone is already carrying, lay the evidence and the credible alternatives beside it, and finish with a next action that can be taken this week — with the reasoning behind it still visible.</p>
                </section>
              </div>

              <section className="prose-block" aria-labelledby="about-approach-title">
                <h2 id="about-approach-title">How a question is worked through</h2>
                <dl className="about-principles">
                  <div className="about-principle">
                    <dt>Evidence before recommendation</dt>
                    <dd>A brief states what is known, what is assumed, and what still needs to be established before a decision is safe.</dd>
                  </div>
                  <div className="about-principle">
                    <dt>Alternatives stay visible</dt>
                    <dd>Credible options are examined side by side rather than collapsed into a single answer.</dd>
                  </div>
                  <div className="about-principle">
                    <dt>No invented certainty</dt>
                    <dd>Where the evidence is thin, the brief says so and names what would change the call.</dd>
                  </div>
                </dl>
                <p className="prose-note">The delivery and hiring example on the home page is an illustrative walkthrough, not a customer result.</p>
              </section>

              <section className="about-clients" aria-labelledby="about-clients-title">
                <h2 id="about-clients-title">Our clients</h2>
                {clientLogos.length === 0 ? (
                  <p className="prose-note">We are not showing client logos yet. Once customers confirm that their mark can be published, it will appear here.</p>
                ) : (
                  <div className="logo-marquee">
                    {[false, true].map(isClone => (
                      <ul className="logo-track" key={isClone ? "clone" : "primary"} role="list" aria-hidden={isClone}>
                        {clientLogos.map(logo => (
                          <li className="logo-slide" key={logo.name}>
                            <Image src={logo.src} alt={isClone ? "" : logo.name} width={132} height={30}/>
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <div className="page-actions" data-scroll-reveal>
              <p className="page-note">Experience the full product free for one month.</p>
              <div className="page-links">
                <a className="button button-primary" href="/sign-up">Start your free month <Icon name="arrow-right" size={16}/></a>
                <a className="page-link" href="/contact">Contact us</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </>
  );
}
