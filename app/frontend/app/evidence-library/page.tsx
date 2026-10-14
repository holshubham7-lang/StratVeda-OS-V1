import { WelcomeCopyrightFooter, WelcomeHeader } from "../../components/site-chrome";
import { EvidenceLibraryForm } from "./evidence-library-form";

export default function EvidenceLibraryPage() {
  return (
    <>
      <a className="skip-link" href="#evidence-library-main">Skip to content</a>
      <WelcomeHeader />
      <main id="evidence-library-main" className="fingerprint-page">
        <EvidenceLibraryForm />
      </main>
      <WelcomeCopyrightFooter />
    </>
  );
}
