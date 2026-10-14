import type { Metadata } from "next";
import { Icon } from "../../components/icon";
import { Breadcrumb, breadcrumbNode, type Crumb } from "../../components/breadcrumb";
import { Footer, Header } from "../../components/site-chrome";
import { ScrollReveal } from "../../components/scroll-reveal";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const pageTitle = "How It Works | StratVeda OS";
const pageDescription =
  "How StratVeda OS works: bring one real business question, examine the evidence and the alternatives, and receive a Decision Brief with a practical next action.";

const howCrumbs: Crumb[] = [{ name: "Home", href: "/" }, { name: "How it works", href: "/how-it-works" }];

type DemoVideo = { src: string; poster: string; captions: string; title: string; description: string; duration: string; published: string };

// Drop the recording and a poster frame into public/assets and fill these fields in — the laptop
// shows its "not recorded yet" state while src is empty. Nothing here is invented.
const demoVideo: DemoVideo = {
  src: "", poster: "", captions: "",
  title: "", description: "", duration: "PT0M", published: "",
};

const walkthroughPoints = [
  { title: "Bringing the question", body: "The session starts with one decision in the founder's own words — scope, deadline, and the outcome being aimed for." },
  { title: "Evidence and assumptions", body: "What the numbers actually support is separated from what is being assumed, and the gaps are named instead of smoothed over." },
  { title: "Alternatives examined", body: "Credible options are put side by side against the same evidence, so the trade-offs stay visible rather than collapsing into one answer." },
  { title: "The next action", body: "The brief closes with something to do — and what would have to become true for a different call to be the right one." },
];

const hasDemo = demoVideo.src.length > 0;

export const metadata: Metadata = {
  title: { absolute: pageTitle },
  description: pageDescription,
  keywords: ["how StratVeda OS works", "decision brief walkthrough", "business decision process", "product demo", "operational success"],
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/how-it-works",
    siteName: "StratVeda OS",
    title: pageTitle,
    description: pageDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${siteUrl}/how-it-works`,
      url: `${siteUrl}/how-it-works`,
      name: "How StratVeda OS works",
      description: pageDescription,
      inLanguage: "en",
      isPartOf: { "@id": `${siteUrl}/#website` },
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    breadcrumbNode(siteUrl, howCrumbs),
    ...(hasDemo
      ? [{
          "@type": "VideoObject",
          "@id": `${siteUrl}/how-it-works#video`,
          name: demoVideo.title,
          description: demoVideo.description,
          thumbnailUrl: `${siteUrl}${demoVideo.poster}`,
          uploadDate: demoVideo.published,
          duration: demoVideo.duration,
          contentUrl: `${siteUrl}${demoVideo.src}`,
          embedUrl: `${siteUrl}/how-it-works`,
          publisher: { "@id": `${siteUrl}/#organization` },
        }]
      : []),
  ],
};

export default function HowItWorksPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollReveal/>
      <Header/>
      <main id="main-content">
        <section className="how-page-section" aria-labelledby="how-page-title">
          <div className="page-width">
            <div className="section-intro section-intro-centered" data-scroll-reveal>
              <Breadcrumb items={howCrumbs}/>
              <h1 id="how-page-title">See how a question becomes a Decision Brief.</h1>
              <p className="section-description">One product walkthrough, start to finish: a real business question going in and a brief with a next action coming out.</p>
            </div>

            <figure className="laptop-demo" data-scroll-reveal>
              <div className="laptop-lid">
                <span className="laptop-camera" aria-hidden="true"/>
                <div className="laptop-screen">
                  {hasDemo ? (
                    <video className="demo-video" src={demoVideo.src} poster={demoVideo.poster} controls playsInline preload="metadata">
                      {demoVideo.captions && <track kind="captions" src={demoVideo.captions} srcLang="en" label="English captions"/>}
                      Your browser cannot play this video. The same steps are written out below.
                    </video>
                  ) : (
                    <div className="demo-empty">
                      <span className="demo-empty-icon" aria-hidden="true">
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path d="M6.5 3.8 16 10l-9.5 6.2z"/></svg>
                      </span>
                      <strong>The product walkthrough is being recorded.</strong>
                      <p>When it is ready it plays here, inside this screen. The written steps below cover the same path.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="laptop-base" aria-hidden="true"><span className="laptop-notch"/></div>
              <figcaption className="laptop-caption">
                {hasDemo ? demoVideo.description : "Illustrative of a real working session — no customer data or results are shown."}
              </figcaption>
            </figure>

            <section className="how-points-section" aria-labelledby="how-points-title">
              <h2 id="how-points-title">What the walkthrough covers</h2>
              <div className="about-values how-points" data-scroll-reveal>
                {walkthroughPoints.map(point => (
                  <article className="about-value" key={point.title}>
                    <h3>{point.title}</h3>
                    <p>{point.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <div className="page-actions" data-scroll-reveal>
              <p className="page-note">Prefer to read it? The worked example on the home page shows one question and the brief it produced.</p>
              <div className="page-links">
                <a className="button button-primary" href="/#worked-example">See the worked example <Icon name="arrow-right" size={16}/></a>
                <a className="page-link" href="/sign-up">Start your free month</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer/>
    </>
  );
}
