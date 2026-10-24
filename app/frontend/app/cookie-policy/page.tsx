import type { Metadata } from "next";
import { LegalPage, createLegalMetadata } from "../../components/legal-page";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stratvedatech.com";
const cookieTitle = "Cookie Policy | StratVeda OS";
const cookieDescription =
  "The cookies StratVeda OS sets, the browser storage it uses to keep your drafts, and how to control both.";

export const metadata: Metadata = createLegalMetadata({
  title: cookieTitle,
  description: cookieDescription,
  path: "/cookie-policy",
  keywords: ["StratVeda OS cookies", "session cookie", "localStorage drafts", "cookie policy India"],
});

export default function CookiePolicyPage() {
  return (
    <LegalPage
      siteUrl={siteUrl}
      title={cookieTitle}
      description={cookieDescription}
      path="/cookie-policy"
      crumbName="Cookie Policy"
      updated="12 October 2026"
      draft="Draft prepared for review. Every entry below was read out of the code as it runs today, so the list is accurate for this build — but the policy text has not been reviewed by legal counsel and should be approved before the site goes live."
      blocks={[
        {
          heading: "What cookies are",
          body: (
            <p>Cookies are small files a site stores in your browser so it can recognise you on the next request. Browser storage works the same way but keeps the data on your device only, and is cleared when you clear your browser data.</p>
          ),
        },
        {
          heading: "Cookies we set",
          body: (
            <>
              <p><strong>ri_access_token</strong> — strictly necessary. It keeps you signed in to StratVeda OS for at least 24 hours. It is HTTP-only (a script on the page cannot read it), scoped to this site with <em>SameSite=Lax</em>, and served over HTTPS only in production. Without it you would be signed out on every page.</p>
              <p><strong>g_csrf_token</strong> — strictly necessary, and set by Google rather than by us. It appears when you choose Sign in with Google and protects that handover from forgery. Google's own policies govern how long it lives.</p>
            </>
          ),
        },
        {
          heading: "Browser storage we use",
          body: (
            <>
              <p>These are not cookies and are never sent to our servers unless you submit the form they belong to:</p>
              <ul>
                <li><strong>Unsent drafts</strong> — <code>stratveda-business-fingerprint-draft</code>, <code>stratveda-strategic-context-draft</code>, <code>stratveda-decision-profile-draft</code>, <code>stratveda-evidence-library-draft</code> and <code>stratveda-executive-brief-answers</code> hold what you have typed so a refresh does not cost you the work. A draft is cleared when that step is saved.</li>
                <li><strong>Onboarding position</strong> — <code>stratveda-onboarding-completed-step</code>, <code>stratveda-onboarding-resume-route</code> and <code>stratveda-onboarding-brief-ready</code> remember how far you got so the product can put you back where you left off.</li>
                <li><strong>One message</strong> — <code>stratveda-flash-notice</code> carries a confirmation across a redirect and is removed as soon as it is shown.</li>
              </ul>
              <p>Clearing site data removes all of it, including any draft you have not saved.</p>
            </>
          ),
        },
        {
          heading: "Analytics and advertising cookies",
          body: (
            <p>This site does not currently set analytics, personalisation or advertising cookies, and it does not pass your information to ad networks. If that ever changes, this page will name the tools and give you a way to decline before any of them load.</p>
          ),
        },
        {
          heading: "Managing cookies",
          body: (
            <p>Your browser lets you block or delete cookies for a specific site — usually under Settings, then Privacy and security, then Cookies and site data. Removing <code>ri_access_token</code> signs you out of StratVeda OS; nothing else stops working, because the product has no optional cookies to lose. Do Not Track and Global Privacy Control signals are not honoured by advertising trackers here, because there are none.</p>
          ),
        },
        {
          heading: "Changes and contact",
          body: (
            <p>If we add a cookie, this page is updated with its purpose and lifetime and the date below changes. Questions: <a href="mailto:hello@stratvedatech.com">hello@stratvedatech.com</a> — StratVeda Technologies Pvt. Ltd. See also the <a href="/privacy-policy">Privacy Policy</a>.</p>
          ),
        },
      ]}
    />
  );
}
