import type { Metadata } from "next";
import { LegalPage, createLegalMetadata } from "../../components/legal-page";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const privacyTitle = "Privacy Policy | StratVeda OS";
const privacyDescription =
  "How StratVeda OS collects, uses, stores and protects the information you enter, and how to exercise your privacy rights.";

export const metadata: Metadata = createLegalMetadata({
  title: privacyTitle,
  description: privacyDescription,
  path: "/privacy-policy",
  keywords: ["StratVeda OS privacy policy", "business decision data", "founder data protection", "AI decision partner privacy"],
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      siteUrl={siteUrl}
      title={privacyTitle}
      description={privacyDescription}
      path="/privacy-policy"
      crumbName="Privacy Policy"
      updated="12 October 2026"
      draft="Draft prepared for review. This text describes the product as it is built today, but it has not been reviewed by legal counsel and is not the company's binding policy until it is approved — please review it before the site goes live."
      blocks={[
        {
          heading: "What we collect",
          body: (
            <>
              <p>We only hold what you give us while using the product, plus the minimum needed to keep a session safe:</p>
              <ul>
                <li><strong>Account details</strong> — your name, email address and, if you sign in with Google, the name, email and profile photo Google shares with you.</li>
                <li><strong>What you enter</strong> — the business question you bring, the context and constraints you describe, and any evidence or documents you choose to add.</li>
                <li><strong>Session data</strong> — a login cookie and, in server logs, basic technical information such as IP address, timestamp and browser type, used to keep the service secure.</li>
              </ul>
              <p>We do not ask for payment card numbers on this site, and we do not collect data about people who are not users of the product.</p>
            </>
          ),
        },
        {
          heading: "How we use it",
          body: (
            <>
              <p>Your information is used to do the job you came for: to keep you signed in, to work through the question you posted, and to produce the Decision Brief you can read and act on. We also use it to keep the service secure, to maintain and improve it, and to reply when you contact us.</p>
              <p>We do not sell your information, and we do not use it to serve advertising.</p>
            </>
          ),
        },
        {
          heading: "Where a brief is generated",
          body: (
            <>
              <p>StratVeda OS uses a hosted large-language-model service to help draft the reasoning in a brief. The question, context and evidence you provide are sent to that provider only to produce the response, under our contract with it. The provider is not licensed to keep your material for its own training.</p>
              <p>Before publication, confirm the named processor and its region here — this is the clause a reviewer will check first.</p>
            </>
          ),
        },
        {
          heading: "Cookies and browser storage",
          body: (
            <p>A small number of cookies keep you signed in, and unsaved form drafts and your onboarding position are kept in your own browser so a refresh does not cost you work. The <a href="/cookie-policy">Cookie Policy</a> lists each one and how to remove it.</p>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <p>For as long as your account is open. If you ask us to delete your account, the question, context, evidence and briefs tied to it are removed from the live product, and anything needed for legal or security reasons is kept only as long as that obligation lasts.</p>
          ),
        },
        {
          heading: "Your choices",
          body: (
            <>
              <p>You can ask us at any time to:</p>
              <ul>
                <li>tell you what information we hold about you;</li>
                <li>correct anything that is wrong;</li>
                <li>delete your account and the material you entered;</li>
                <li>stop processing something you previously agreed to.</li>
              </ul>
              <p>Write to <a href="mailto:hello@stratvedatech.com">hello@stratvedatech.com</a> and we will handle the request. We aim to comply with applicable Indian data protection law, including the Digital Personal Data Protection Act, 2023, and with any other law that applies to you where you use the product.</p>
            </>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>The site is served over HTTPS, the login cookie is HTTP-only and restricted to this site, and access to production systems is limited to what a person's role requires. No method of transmission or storage is absolute, so we describe our safeguards rather than promise that risk is zero.</p>
          ),
        },
        {
          heading: "Children",
          body: (
            <p>StratVeda OS is a business tool intended for adults. It is not directed at children, and we do not knowingly collect information from anyone under eighteen.</p>
          ),
        },
        {
          heading: "Changes to this policy",
          body: (
            <p>If this policy changes, the page is updated and the date at the bottom of the page changes with it. A material change to how we use your information will be announced in the product before it takes effect.</p>
          ),
        },
        {
          heading: "Contact",
          body: (
            <p>StratVeda Technologies Pvt. Ltd. — StratVeda OS. Privacy questions and requests: <a href="mailto:hello@stratvedatech.com">hello@stratvedatech.com</a>. Company site: <a href="https://stratvedatech.com/" target="_blank" rel="noopener noreferrer">stratvedatech.com</a>.</p>
          ),
        },
      ]}
    />
  );
}
