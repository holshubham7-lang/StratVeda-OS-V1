import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { StrategicContextForm } from "./strategic-context-form";
import { SessionRequired } from "../../components/session-required";

export default function StrategicContextPage() {
  return (
    <SessionRequired>
      <a className="skip-link" href="#strategic-context-main">Skip to content</a>
      <WelcomeHeader />
      <main id="strategic-context-main" className="fingerprint-page">
        <StrategicContextForm />
      </main>
      <WelcomeCopyrightFooter />
    </SessionRequired>
  );
}
