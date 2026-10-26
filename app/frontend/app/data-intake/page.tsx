import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { SessionRequired } from "../../components/session-required";
import { DataIntakeClient } from "./data-intake-client";

export default function DataIntakePage() {
  return (
    <SessionRequired>
      <a className="skip-link" href="#data-intake-main">Skip to content</a>
      <WelcomeHeader />
      <main id="data-intake-main" className="fingerprint-page">
        <DataIntakeClient />
      </main>
      <WelcomeCopyrightFooter />
    </SessionRequired>
  );
}
