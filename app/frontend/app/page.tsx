import { Fragment, type CSSProperties } from "react";
import type { Metadata } from "next";
import { Icon } from "../components/icon";
import { Footer, Header } from "../components/site-chrome";
import { ScrollReveal } from "../components/scroll-reveal";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const homeTitle = "StratVeda OS | Operational Success for Founders";
const homeDescription =
  "Bring a real business question to StratVeda OS. Examine the evidence and alternatives, and get a focused Decision Brief with a practical next step.";

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  keywords: ["operational success", "business decision support", "decision brief", "AI decision partner", "StratVeda OS"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "StratVeda OS",
    title: homeTitle,
    description: homeDescription,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "StratVeda OS — Operational Success" }],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: ["/opengraph-image"],
  },
};

const briefPathSteps = [
  {
    title: "Start your free month",
    description: "Create your account to access the full StratVeda OS experience for one month.",
  },
  {
    title: "Describe the decision",
    description: "Explain what is happening, what you want to achieve, and the constraints that matter.",
  },
  {
    title: "Work through the evidence",
    description: "Clarify important information, examine assumptions, and consider credible alternatives.",
  },
  {
    title: "Review your Decision Brief",
    description:
      "Get a focused recommendation and practical next action—or a clear account of what must be established before deciding.",
  },
];

const exampleBriefFields = [
  { label: "THE CALL", value: "Identify where delivery time is being lost before committing to a permanent hire." },
  { label: "WHY", value: "The reported delays do not yet establish that additional headcount would solve the problem." },
  { label: "EVIDENCE AVAILABLE", value: "The founder reports missed delivery dates. The cause has not been established." },
  {
    label: "NEXT ACTION",
    value:
      "Before the hiring decision, have the delivery lead review recently delayed work and separate active work time, rework, and time spent waiting for approval.",
  },
  { label: "SUCCESS CONDITION", value: "The review identifies a recurring source of delay clearly enough to select a targeted next action." },
  { label: "WHAT WOULD CHANGE THE CALL", value: "Evidence that workload consistently exceeds available staff capacity and that rework or approval delays are not the primary cause." },
];

const questionCards = [
  {
    icon: "trend" as const,
    title: "What should we fix first?",
    description: "Work through competing problems and identify which deserves attention now.",
  },
  {
    icon: "compare" as const,
    title: "Should we hire or improve the process?",
    description: "Examine whether the evidence supports adding capacity, changing how work gets done, or investigating further.",
  },
  {
    icon: "arrow-up-right" as const,
    title: "Should we invest more?",
    description: "Challenge the assumptions behind a larger commitment and consider whether a smaller test should come first.",
  },
  {
    icon: "check-square" as const,
    title: "Does this plan make sense?",
    description: "Assess a proposed move against your objective, constraints, and alternatives.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "StratVeda Technologies",
      url: "https://stratvedatech.com/",
      logo: `${siteUrl}/assets/brand-mark.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: "StratVeda OS",
      description: homeDescription,
      inLanguage: "en",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "StratVeda OS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${siteUrl}/`,
      description: homeDescription,
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

function HeroWords({ text, start = 0 }: { text: string; start?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="hero-word" style={{ "--word-index": start + index } as CSSProperties}>{word}</span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-inner page-width">
        <div className="hero-copy">
          <span className="eyebrow-pill"><span className="eyebrow-dot"/> StratVeda OS · Operational Success</span>
          <h1 id="hero-title"><HeroWords text="What should your business do next?"/>{" "}<span className="hero-subline"><HeroWords text="Hire, fix the process, or invest more?" start={7}/></span></h1>
          <p className="hero-description"><HeroWords start={17} text="Bring the decision you are working through. StratVeda OS helps you examine the available evidence and develop a focused Decision Brief: the recommended next move, why it matters, and what would change the call."/></p>
          <div className="hero-actions">
            <a className="button button-primary" href="/sign-up">Start your free month <Icon name="arrow-right" size={17}/></a>
            <a className="button button-secondary" href="#worked-example">See a worked example</a>
          </div>
          <p className="hero-reassurance"><Icon name="check" size={15}/> <strong>Experience the full product free for one month.</strong></p>
        </div>
        <ul className="dot-steps hero-steps" role="list">
          <li>Bring one real business question.</li>
          <li>Examine the evidence and alternatives.</li>
          <li>Define a practical next action.</li>
        </ul>
      </div>
    </section>
  );
}

function FounderMove() {
  return (
    <section className="founder-section page-width" id="founder-next-move" aria-labelledby="founder-title">
      <div className="founder-card" data-scroll-reveal>
        <p className="founder-eyebrow">The founder’s next move</p>
        <h2 id="founder-title">When everything needs attention, what comes first?</h2>
        <ul className="founder-list" role="list">
          <li>A hiring request.</li>
          <li>A delivery problem.</li>
          <li>A growth opportunity.</li>
          <li>A target that keeps slipping.</li>
        </ul>
        <p className="founder-copy">Each could lead to a different next move. StratVeda OS helps you examine those choices against the outcome you want, the constraints you face, and the evidence available.</p>
        <hr className="founder-divider"/>
        <p className="founder-punch">Not just a list of possibilities. A recommendation you can evaluate and act on.</p>
        <a className="founder-link" href="#decision-brief-path">See how it works <Icon name="arrow-right" size={16}/></a>
      </div>
    </section>
  );
}

function DecisionPath() {
  return (
    <section className="brief-path-section section-pad" id="decision-brief-path" aria-labelledby="brief-path-title">
      <div className="page-width brief-path-grid">
        <div className="section-intro brief-path-intro" data-scroll-reveal>
          <p className="eyebrow">FROM QUESTION TO NEXT ACTION</p>
          <h2 id="brief-path-title">Your first Decision Brief starts with one question.</h2>
          <p className="brief-path-note">Sometimes the next move is to act. Sometimes it is to establish what you need to know first.</p>
        </div>
        <ol className="brief-path-steps" role="list">
          {briefPathSteps.map((step, index) => (
            <li className="brief-step" key={step.title} data-scroll-reveal>
              <span className="brief-step-num" aria-hidden="true">{index + 1}</span>
              <div className="brief-step-body">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function WorkedExample() {
  return (
    <section className="example-section" id="worked-example" aria-labelledby="example-title">
      <div className="page-width">
        <div className="section-intro example-intro" data-scroll-reveal>
          <p className="eyebrow">SEE THE OUTPUT</p>
          <h2 id="example-title">“Delivery is slipping. Should we hire?”</h2>
          <p className="section-description">See how a broad concern becomes a decision you can evaluate.</p>
        </div>
        <p className="example-disclaimer">Illustrative walkthrough — not a customer result.</p>
        <div className="example-grid">
          <figure className="example-input" data-scroll-reveal>
            <blockquote>
              <p>“We are missing delivery dates. I am considering hiring another person, but I am not sure that will solve the problem.”</p>
            </blockquote>
            <figcaption>
              <p className="example-label">WHAT NEEDS CLARIFICATION</p>
              <p>Is the delay coming from excessive workload, repeated rework, or time spent waiting for approvals?</p>
            </figcaption>
          </figure>
          <article className="example-brief" data-scroll-reveal aria-labelledby="example-brief-title">
            <header className="example-brief-head">
              <h3 id="example-brief-title">Decision Brief</h3>
              <p className="example-brief-topic">Delivery capacity</p>
            </header>
            <dl className="example-brief-fields">
              {exampleBriefFields.map((field) => (
                <div className="example-field" key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
        <p className="example-punch">The question moves from “Should we hire?” to “What evidence would justify hiring?”</p>
        <div className="example-actions">
          <a className="button button-primary" href="/sign-up">Start your free month</a>
        </div>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className="cta-section page-width" id="get-started" aria-labelledby="cta-title" data-scroll-reveal>
      <div className="cta-content">
        <p className="cta-eyebrow">GET STARTED</p>
        <h2 id="cta-title">Give your next business decision a closer look.</h2>
        <ul className="dot-steps cta-steps" role="list">
          <li>Bring one real business question.</li>
          <li>Examine the evidence and alternatives.</li>
          <li>Define a practical next action.</li>
        </ul>
        <p className="cta-free-month">Experience the full StratVeda OS product free for one month.</p>
        <div className="cta-actions">
          <a className="button button-primary" href="/sign-up">Start your free month <Icon name="arrow-right" size={16}/></a>
          <a className="cta-secondary" href="/sign-in">Already have an account? Log in</a>
          <a className="cta-secondary" href="/faq">Read the FAQs</a>
        </div>
      </div>
    </section>
  );
}

function BringYourQuestion() {
  return (
    <section className="question-section" id="bring-your-question" aria-labelledby="question-title">
      <div className="page-width">
        <div className="section-intro question-intro" data-scroll-reveal>
          <p className="eyebrow">BRING YOUR REAL QUESTION</p>
          <h2 id="question-title">Which decision are you working through?</h2>
        </div>
        <ul className="question-grid" role="list">
          {questionCards.map((card) => (
            <li className="question-card" key={card.title} data-scroll-reveal>
              <span className="question-icon"><Icon name={card.icon} size={21}/></span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function HomePage() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/><a className="skip-link" href="#main-content">Skip to content</a><ScrollReveal/><Header/><main id="main-content"><Hero/><FounderMove/><DecisionPath/><WorkedExample/><BringYourQuestion/><GetStarted/></main><Footer/></>;
}
