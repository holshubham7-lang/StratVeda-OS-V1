import type { Metadata } from "next";
import { LegalPage, createLegalMetadata } from "../../components/legal-page";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const termsTitle = "Terms & Conditions | StratVeda OS";
const termsDescription =
  "The terms that apply when you use StratVeda OS — your account, your material, what the product does and does not promise, and how the service can change.";

export const metadata: Metadata = createLegalMetadata({
  title: termsTitle,
  description: termsDescription,
  path: "/terms",
  keywords: ["StratVeda OS terms", "decision support terms of use", "AI decision partner terms", "founder software terms"],
});

export default function TermsPage() {
  return (
    <LegalPage
      siteUrl={siteUrl}
      title={termsTitle}
      description={termsDescription}
      path="/terms"
      crumbName="Terms & Conditions"
      updated="12 October 2026"
      draft="Draft prepared for review. These terms were written from how the product actually behaves today, but they have not been reviewed by legal counsel and are not binding until approved — please have them checked before the site goes live."
      blocks={[
        {
          heading: "Agreement",
          body: (
            <p>By accessing this site or using StratVeda OS you accept these terms and the <a href="/privacy-policy">Privacy Policy</a>. If you are using the product on behalf of a company, you confirm you can bind that company. If you do not accept them, do not create an account.</p>
          ),
        },
        {
          heading: "Your account",
          body: (
            <>
              <p>You must give accurate information and keep your credentials private. You are responsible for what happens under your account, so tell us promptly at <a href="mailto:hello@stratvedatech.com">hello@stratvedatech.com</a> if you believe it has been accessed by someone else.</p>
              <p>You must be eighteen or older and legally able to enter into these terms.</p>
            </>
          ),
        },
        {
          heading: "What StratVeda OS is — and is not",
          body: (
            <>
              <p>StratVeda OS is decision support. It takes one business question at a time and helps you examine the evidence, the assumptions and the credible alternatives, then produces a written Decision Brief with a recommended next action — or a clear account of what still needs to be established before deciding.</p>
              <p>A brief is not legal, financial, tax, investment, medical, audit or regulatory advice, and it is not a professional opinion about your business. You decide. You remain responsible for the decision and for the outcome, and a brief is one input into it rather than a substitute for your own judgement or for advice from a qualified professional.</p>
              <p>Any worked example shown in the product or on this site is an illustrative walkthrough, not a customer result.</p>
            </>
          ),
        },
        {
          heading: "Your material",
          body: (
            <>
              <p>You keep ownership of everything you enter or upload. You grant StratVeda Technologies a limited licence to process it for the purpose you asked for: working through your question and producing, storing and showing you the resulting brief.</p>
              <p>You confirm that you have the right to submit the material you enter, that it does not breach anyone else's confidentiality or intellectual property, and that you are allowed to send it to us. Please do not enter personal information about third parties that you have no basis to share.</p>
            </>
          ),
        },
        {
          heading: "Acceptable use",
          body: (
            <ul>
              <li>Use the product lawfully and for your own business decisions.</li>
              <li>Do not attempt to disrupt, overload, reverse engineer, scrape or resell the service.</li>
              <li>Do not present a brief as a guarantee of outcome, a professional certification, or evidence of a result the product cannot support.</li>
              <li>Do not use automated access in a way that bypasses the limits the service publishes.</li>
            </ul>
          ),
        },
        {
          heading: "Plans, the free month and billing",
          body: (
            <p>The full product is offered free for one month, as described where you sign up. After that month, the plan and price you select at sign-up apply, and we will show the charge to you before you confirm it. Fees, renewal and refund terms are those presented at sign-up; any paid plan you later choose will state its own billing terms before payment.</p>
          ),
        },
        {
          heading: "Availability, changes and interruption",
          body: (
            <p>The service is provided as it is, and we may change, improve or retire features. We aim to keep it available but do not promise uninterrupted access; maintenance, provider failures and events outside our control happen. Where a paid plan carries a service commitment, that commitment is the one stated in the plan you bought.</p>
          ),
        },
        {
          heading: "Suspension and ending",
          body: (
            <p>You can stop using the product at any time and ask us to delete your account. We may suspend or end access where use breaches these terms, threatens the service or its users, or where we are required to by law — and we will tell you why unless we are not permitted to.</p>
          ),
        },
        {
          heading: "Liability",
          body: (
            <p>To the extent the law allows, StratVeda Technologies is not liable for indirect, incidental, consequential or special loss, or for a business decision you took with or without a brief. Our total liability for any claim is limited to the amount you paid for the product in the twelve months before the claim, and where you are on a free month, to that extent no fee is recoverable. Nothing here limits liability that cannot lawfully be limited.</p>
          ),
        },
        {
          heading: "Governing law",
          body: (
            <p>These terms are governed by the laws of India, and the courts competent in India have jurisdiction over disputes. A reviewer should confirm the seat and whether any arbitration clause is wanted before publication.</p>
          ),
        },
        {
          heading: "Changes to these terms and contact",
          body: (
            <p>We may update these terms; the date at the bottom of this page changes when we do, and a material change will be announced in the product. Questions: <a href="mailto:hello@stratvedatech.com">hello@stratvedatech.com</a> — StratVeda Technologies Pvt. Ltd.</p>
          ),
        },
      ]}
    />
  );
}
