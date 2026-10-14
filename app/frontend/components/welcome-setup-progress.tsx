"use client";

import Link from "next/link";

export function WelcomeSetupProgress() {
  const actionLabel = "Start Business Setup";
  const nextStepName = "Understand Your Business";

  return (
    <>
      <div className="welcome-next-step">
        <span className="welcome-next-step-icon" aria-hidden="true">→</span>
        <div><span className="welcome-next-step-label">UP NEXT</span><strong>{nextStepName}</strong><p>A few quick questions to understand your business.</p></div>
      </div>
      <div className="welcome-actions">
        <Link className="button button-primary welcome-continue" href="/business-fingerprint">{actionLabel}<span aria-hidden="true">→</span></Link>
      </div>
    </>
  );
}
