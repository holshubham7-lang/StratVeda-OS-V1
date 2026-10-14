import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { DecisionProfileForm } from "./decision-profile-form";

export default function DecisionProfilePage() {
  return (
    <>
      <a className="skip-link" href="#decision-profile-main">Skip to content</a>
      <WelcomeHeader />
      <main id="decision-profile-main" className="fingerprint-page">
        <DecisionProfileForm />
      </main>
      <WelcomeCopyrightFooter />
    </>
  );
}
