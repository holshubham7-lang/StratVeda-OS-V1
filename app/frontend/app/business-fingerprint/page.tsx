import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { BusinessFingerprintForm } from "./business-fingerprint-form";
import { SessionRequired } from "../../components/session-required";

export default function BusinessFingerprintPage() {
  return (
    <SessionRequired>
      <a className="skip-link" href="#fingerprint-main">Skip to content</a>
      <WelcomeHeader />
      <main id="fingerprint-main" className="fingerprint-page">
        <BusinessFingerprintForm />
      </main>
      <WelcomeCopyrightFooter />
    </SessionRequired>
  );
}
