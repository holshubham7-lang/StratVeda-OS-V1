"use client";

import { useState } from "react";
import { FeedbackToast, type ToastNotice } from "../../components/feedback-toast";
import { Brand } from "../../components/site-chrome";

export default function ForgotPasswordPage() {
  const [notice, setNotice] = useState<ToastNotice | null>(null);

  function handleResetRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement;
    if (!email.checkValidity()) {
      showNotice("Please enter a valid email address.", "error");
      email.focus();
      return;
    }
    showNotice("Password reset is not connected yet. Your email has not been sent.");
  }

  function showNotice(message: string, kind: ToastNotice["kind"] = "info") {
    setNotice({ kind, title: kind === "error" ? "Check your email" : "Password reset unavailable", message });
  }

  return (
    <main className="signup-page">
      <section className="signup-layout" aria-label="Reset your Decision Intelligence password">
        <aside className="signup-story">
          <Brand />
          <div className="signup-story-copy">
            <span className="signup-kicker"><i/> ACCOUNT ACCESS</span>
            <h1>Let’s get you back to your revenue view.</h1>
            <p>Enter the email address you use for Decision Intelligence and we’ll help you regain access.</p>
          </div>
          <p className="signup-privacy"><span aria-hidden="true">✓</span> Your account details stay private and secure.</p>
        </aside>

        <section className="signup-panel" aria-labelledby="forgot-password-title">
          <div className="signup-panel-mobile-brand">
            <Brand compact/>
          </div>
          <div className="signup-form-wrap">
            <span className="signup-eyebrow">ACCOUNT RECOVERY</span>
            <h2 id="forgot-password-title">Reset your password</h2>
            <p className="signup-subtitle">Enter the email address you use for Decision Intelligence to request a password reset.</p>
            <form className="signup-manual-form forgot-password-form" onSubmit={handleResetRequest} noValidate>
              <label htmlFor="reset-email">Email address</label>
              <input id="reset-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required/>
              <button className="signup-create-button" type="submit">Send reset link <span aria-hidden="true">→</span></button>
            </form>
            <p className="signup-switch"><a href="/sign-in">← Back to sign in</a></p>
          </div>
          <p className="signup-legal">We’ll only use your email to help restore access to your account.</p>
        </section>
      </section>
      <FeedbackToast notice={notice} onDismiss={() => setNotice(null)}/>
    </main>
  );
}
